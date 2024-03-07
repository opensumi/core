import debounce from 'lodash/debounce';
import flattenDeep from 'lodash/flattenDeep';
import groupBy from 'lodash/groupBy';

import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import {
  AppConfig,
  Deferred,
  Disposable,
  Emitter,
  Event,
  IDisposable,
  IRange,
  LRUCache,
  LabelService,
  URI,
  formatLocalize,
  getIcon,
  localize,
  memoize,
  positionToRange,
} from '@opensumi/ide-core-browser';
import { IEditor } from '@opensumi/ide-editor';
import {
  IEditorDecorationCollectionService,
  IEditorDocumentModelService,
  ResourceService,
  WorkbenchEditorService,
} from '@opensumi/ide-editor/lib/browser';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { IIconService, IconType } from '@opensumi/ide-theme';
import * as model from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import * as textModel from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import {
  CommentPanelId,
  ICommentRangeProvider,
  ICommentsFeatureRegistry,
  ICommentsService,
  ICommentsThread,
  ICommentsThreadOptions,
  IWriteableCommentsTreeNode,
} from '../common';

import { CommentsPanel } from './comments-panel.view';
import { CommentsThread } from './comments-thread';
import { CommentContentNode, CommentFileNode, CommentReplyNode, CommentRoot } from './tree/tree-node.defined';

@Injectable()
export class CommentsService extends Disposable implements ICommentsService {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(IEditorDecorationCollectionService)
  private readonly editorDecorationCollectionService: IEditorDecorationCollectionService;

  @Autowired(IIconService)
  private readonly iconService: IIconService;

  @Autowired(LabelService)
  private readonly labelService: LabelService;

  @Autowired(ICommentsFeatureRegistry)
  private readonly commentsFeatureRegistry: ICommentsFeatureRegistry;

  @Autowired(IEditorDocumentModelService)
  private readonly documentService: IEditorDocumentModelService;

  @Autowired(IMainLayoutService)
  private readonly layoutService: IMainLayoutService;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired(ResourceService)
  private readonly resourceService: ResourceService;

  private decorationChangeEmitter = new Emitter<URI>();

  private threads = new Map<string, ICommentsThread>();

  private threadsChangeEmitter = new Emitter<ICommentsThread>();

  private threadsCommentChangeEmitter = new Emitter<ICommentsThread>();

  private threadsCreatedEmitter = new Emitter<ICommentsThread>();

  private rangeProviderMap = new Map<string, ICommentRangeProvider>();

  private rangeOwner = new Map<string, IRange[]>();

  private providerDecorationCache = new LRUCache<string, Deferred<IRange[]>>(10000);

  // 默认在 file 协议和 git 协议中显示评论数据
  private shouldShowCommentsSchemes = new Set(['file', 'git']);

  private decorationProviderDisposer = Disposable.NULL;

  get commentsThreads() {
    return [...this.threads.values()];
  }

  @memoize
  get isMultiCommentsForSingleLine() {
    return !!this.commentsFeatureRegistry.getConfig()?.isMultiCommentsForSingleLine;
  }

  @memoize
  get currentAuthorAvatar() {
    return this.commentsFeatureRegistry.getConfig()?.author?.avatar;
  }

  @memoize
  get filterThreadDecoration() {
    return this.commentsFeatureRegistry.getConfig()?.filterThreadDecoration;
  }

  get onThreadsChanged(): Event<ICommentsThread> {
    return this.threadsChangeEmitter.event;
  }

  get onThreadsCommentChange(): Event<ICommentsThread> {
    return this.threadsCommentChangeEmitter.event;
  }

  get onThreadsCreated(): Event<ICommentsThread> {
    return this.threadsCreatedEmitter.event;
  }

  /**
   * -------------------------------- IMPORTANT --------------------------------
   * 需要注意区分 model.IModelDecorationOptions 与 monaco.editor.IModelDecorationOptions 两个类型
   * 将 model.IModelDecorationOptions 类型的对象传给签名为 monaco.editor.IModelDecorationOptions 的方法时需要做 Type Assertion
   * 这是因为 monaco.d.ts 与 vs/editor/common/model 分别导出了枚举 TrackedRangeStickiness
   * 这种情况下两个枚举的类型是不兼容的，即使他们是同一段代码的编译产物
   * -------------------------------- IMPORTANT --------------------------------
   * @param thread
   */
  private createThreadDecoration(thread: ICommentsThread): model.IModelDecorationOptions {
    // 对于新增的空的 thread，默认显示当前用户的头像，否则使用第一个用户的头像
    const avatar =
      thread.comments.length === 0 ? this.currentAuthorAvatar : thread.comments[0].author.iconPath?.toString();
    const icon = avatar
      ? this.iconService.fromIcon('', avatar, IconType.Background)
      : this.iconService.fromString('$(comment-unresolved)');
    const decorationOptions: model.IModelDecorationOptions = {
      description: 'comments-thread-decoration',
      // 创建评论显示在 glyph margin 处
      glyphMarginClassName: ['comments-decoration', 'comments-thread', icon].join(' '),
    };
    return textModel.ModelDecorationOptions.createDynamic(decorationOptions);
  }

  private createHoverDecoration(): model.IModelDecorationOptions {
    const decorationOptions: model.IModelDecorationOptions = {
      description: 'comments-hover-decoration',
      linesDecorationsClassName: ['comments-decoration', 'comments-add', getIcon('add-comments')].join(' '),
    };
    return textModel.ModelDecorationOptions.createDynamic(decorationOptions);
  }

  public init() {
    const schemes = this.resourceService.getSupportedSchemes();
    for (const scheme of schemes) {
      this.shouldShowCommentsSchemes.add(scheme);
    }

    // 插件注册 ResourceProvider 时重新注册 CommentDecorationProvider
    // 例如 Github Pull Request 插件的 scheme 为 pr
    this.addDispose(
      this.resourceService.onRegisterResourceProvider((provider) => {
        if (provider.scheme) {
          this.shouldShowCommentsSchemes.add(provider.scheme);
          this.registerDecorationProvider();
        }
      }),
    );
    this.addDispose(
      this.resourceService.onUnregisterResourceProvider((provider) => {
        if (provider.scheme) {
          this.shouldShowCommentsSchemes.delete(provider.scheme);
          this.registerDecorationProvider();
        }
      }),
    );
    this.registerDecorationProvider();
  }

  public handleOnCreateEditor(editor: IEditor) {
    const disposer = new Disposable();

    disposer.addDispose(
      editor.monacoEditor.onMouseDown((event) => {
        if (
          event.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS &&
          event.target.element &&
          event.target.element.className.indexOf('comments-add') > -1
        ) {
          const { target } = event;
          if (target && target.range) {
            const { range } = target;
            // 如果已经存在一个待输入的评论组件，则不创建新的
            if (
              !this.commentsThreads.some(
                (thread) =>
                  thread.comments.length === 0 &&
                  thread.uri.isEqual(editor.currentUri!) &&
                  thread.range.startLineNumber === range.startLineNumber,
              )
            ) {
              const thread = this.createThread(editor.currentUri!, range);
              thread.show(editor);
            }
            event.event.stopPropagation();
          }
        } else if (
          event.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN &&
          event.target.element &&
          event.target.element.className.indexOf('comments-thread') > -1
        ) {
          const { target } = event;
          if (target && target.range) {
            const { range } = target;
            const threads = this.commentsThreads.filter(
              (thread) =>
                thread.uri.isEqual(editor.currentUri!) && thread.range.startLineNumber === range.startLineNumber,
            );
            if (threads.length) {
              // 判断当前 widget 是否是显示的
              const isShowWidget = threads.some((thread) => thread.isShowWidget(editor));

              if (isShowWidget) {
                threads.forEach((thread) => thread.hide(editor));
              } else {
                threads.forEach((thread) => thread.show(editor));
              }
            }
          }
          event.event.stopPropagation();
        }
      }),
    );
    let oldDecorations: string[] = [];
    disposer.addDispose(
      editor.monacoEditor.onMouseMove(
        debounce(async (event) => {
          const uri = editor.currentUri;

          const range = event.target.range;
          if (uri && range && (await this.shouldShowHoverDecoration(uri, range))) {
            oldDecorations = editor.monacoEditor.deltaDecorations(oldDecorations, [
              {
                range: positionToRange(range.startLineNumber),
                options: this.createHoverDecoration() as unknown as monaco.editor.IModelDecorationOptions,
              },
            ]);
          } else {
            oldDecorations = editor.monacoEditor.deltaDecorations(oldDecorations, []);
          }
        }, 10),
      ),
    );

    disposer.addDispose(
      editor.monacoEditor.onMouseLeave(
        debounce(() => {
          oldDecorations = editor.monacoEditor.deltaDecorations(oldDecorations, []);
        }, 10),
      ),
    );

    return disposer;
  }

  private async shouldShowHoverDecoration(uri: URI, range: IRange) {
    if (!this.shouldShowCommentsSchemes.has(uri.scheme)) {
      return false;
    }
    const contributionRanges = await this.getContributionRanges(uri);
    const isProviderRanges = contributionRanges.some(
      (contributionRange) =>
        range.startLineNumber >= contributionRange.startLineNumber &&
        range.startLineNumber <= contributionRange.endLineNumber,
    );
    // 如果不支持对同一行进行多个评论，那么过滤掉当前有 thread 行号的 decoration
    const isShowHoverToSingleLine =
      this.isMultiCommentsForSingleLine ||
      !this.commentsThreads.some(
        (thread) => thread.uri.isEqual(uri) && thread.range.startLineNumber === range.startLineNumber,
      );
    return isProviderRanges && isShowHoverToSingleLine;
  }

  public createThread(
    uri: URI,
    range: IRange,
    options: ICommentsThreadOptions = {
      comments: [],
      readOnly: false,
    },
  ) {
    // 获取当前 range 的 providerId，用于 commentController contextKey 的生成
    const providerId = this.getProviderIdsByLine(range.startLineNumber)[0];
    const thread = this.injector.get(CommentsThread, [uri, range, providerId, options]);
    thread.onDispose(() => {
      this.threads.delete(thread.id);
      this.threadsChangeEmitter.fire(thread);
      this.decorationChangeEmitter.fire(uri);
    });
    thread.onDidChange(() => {
      this.threadsChangeEmitter.fire(thread);
    });
    this.threads.set(thread.id, thread);
    this.addDispose(thread);
    this.threadsChangeEmitter.fire(thread);
    this.threadsCreatedEmitter.fire(thread);
    this.decorationChangeEmitter.fire(uri);
    return thread;
  }

  public getThreadsByUri(uri: URI) {
    return (
      this.commentsThreads
        .filter((thread) => thread.uri.isEqual(uri))
        // 默认按照 rang 顺序 升序排列
        .sort((a, b) => a.range.startLineNumber - b.range.startLineNumber)
    );
  }

  public handleCommentFileNode(parent: CommentRoot): CommentFileNode[] {
    const childs: CommentFileNode[] = [];

    const commentThreads = [...this.threads.values()].filter((thread) => thread.comments.length);
    const threadUris = groupBy(commentThreads, (thread: ICommentsThread) => thread.uri);
    Object.keys(threadUris).map((uri) => {
      const threads: ICommentsThread[] = threadUris[uri];
      if (threads.length === 0) {
        return;
      }
      const workspaceDir = new URI(this.appConfig.workspaceDir);
      const resource = new URI(uri);
      const description = workspaceDir.relative(resource)?.toString();
      childs.push(
        new CommentFileNode(
          this,
          threads,
          description,
          resource.codeUri.fsPath,
          this.labelService.getIcon(resource),
          resource,
          parent,
        ),
      );
    });

    return childs;
  }

  public handleCommentContentNode(parent: CommentFileNode): CommentContentNode[] {
    const childs: CommentContentNode[] = [];

    for (const thread of (parent as CommentFileNode).threads) {
      const [first] = thread.comments;
      const comment = typeof first.body === 'string' ? first.body : first.body.value;
      childs.push(
        new CommentContentNode(
          this,
          thread,
          comment,
          `[Ln ${thread.range.startLineNumber}]`,
          first.author.iconPath
            ? (this.iconService.fromIcon('', first.author.iconPath.toString(), IconType.Background) as string)
            : getIcon('message'),
          first.author,
          parent.resource,
          parent as CommentFileNode,
        ),
      );
    }

    return childs;
  }

  public handleCommentReplyNode(parent: CommentContentNode): CommentReplyNode[] {
    const childs: CommentReplyNode[] = [];

    const thread = parent.thread;
    const [_, ...others] = thread.comments;
    const lastReply = others[others.length - 1].author.name;
    childs.push(
      new CommentReplyNode(
        this,
        thread,
        formatLocalize('comment.reply.count', others?.length || 0),
        formatLocalize('comment.reply.lastReply', lastReply),
        '',
        parent.resource,
        parent,
      ),
    );

    return childs;
  }

  async resolveChildren(parent?: CommentRoot | CommentFileNode | CommentContentNode) {
    let childs: (CommentRoot | CommentFileNode | CommentContentNode | CommentReplyNode)[] = [];
    if (!parent) {
      childs.push(new CommentRoot(this));
    } else {
      if (CommentRoot.isRoot(parent)) {
        childs = this.handleCommentFileNode(parent);
      } else if (CommentFileNode.is(parent)) {
        childs = this.handleCommentContentNode(parent);
      } else if (CommentContentNode.is(parent)) {
        childs = this.handleCommentReplyNode(parent);
      }
    }
    if (childs.length === 1 && CommentRoot.isRoot(childs[0])) {
      return childs;
    }
    const handlers = this.commentsFeatureRegistry.getCommentsPanelTreeNodeHandlers();
    if (handlers.length > 0) {
      for (const handler of handlers) {
        childs = handler(childs as IWriteableCommentsTreeNode[]) as (
          | CommentFileNode
          | CommentContentNode
          | CommentReplyNode
        )[];
      }
    }
    return childs;
  }

  public async getContributionRanges(uri: URI): Promise<IRange[]> {
    // 一个diff editor对应两个uri，两个uri的rangeOwner不应该互相覆盖
    const cache = this.providerDecorationCache.get(uri.toString());
    // 优先从缓存中拿
    if (cache) {
      return await cache.promise;
    }

    const model = this.documentService.getModelReference(uri, 'get-contribution-rages');
    const rangePromise: Promise<IRange[]>[] = [];
    for (const rangeProvider of this.rangeProviderMap) {
      const [id, provider] = rangeProvider;
      rangePromise.push(
        (async () => {
          const ranges = await provider.getCommentingRanges(model?.instance!);
          if (ranges && ranges.length) {
            // FIXME: ranges 会被 Diff uri 的两个 range 互相覆盖，导致可能根据行查不到 provider
            this.rangeOwner.set(id, ranges);
          }
          return ranges!;
        })(),
      );
    }
    const deferredRes = new Deferred<IRange[]>();
    this.providerDecorationCache.set(uri.toString(), deferredRes);
    const res = await Promise.all(rangePromise);
    // 消除 document 引用
    model?.dispose();
    // 拍平，去掉 undefined
    const flattenRange: IRange[] = flattenDeep(res).filter(Boolean) as IRange[];
    deferredRes.resolve(flattenRange);
    return flattenRange;
  }

  public fireThreadCommentChange(thread: ICommentsThread) {
    this.threadsCommentChangeEmitter.fire(thread);
  }

  private registerDecorationProvider() {
    // dispose 掉上一个 decorationProvider
    this.decorationProviderDisposer.dispose();
    this.decorationProviderDisposer = this.editorDecorationCollectionService.registerDecorationProvider({
      schemes: [...this.shouldShowCommentsSchemes.values()],
      key: 'comments',
      onDidDecorationChange: this.decorationChangeEmitter.event,
      provideEditorDecoration: (uri: URI) =>
        this.commentsThreads
          .map((thread) => {
            if (thread.uri.isEqual(uri)) {
              if (thread.comments.length) {
                // 存在评论内容 恢复之前的现场
                thread.showWidgetsIfShowed();
              }
            } else {
              // 临时隐藏，当切回来时会恢复
              thread.hideWidgetsByDispose();
            }
            return thread;
          })
          .filter((thread) => {
            const isCurrentThread = thread.uri.isEqual(uri);
            if (this.filterThreadDecoration) {
              return isCurrentThread && this.filterThreadDecoration(thread);
            }
            return isCurrentThread;
          })
          .map((thread) => ({
            range: thread.range,
            options: this.createThreadDecoration(thread) as unknown as monaco.editor.IModelDecorationOptions,
          })),
    });
    this.addDispose(this.decorationProviderDisposer);
  }

  public registerCommentPanel() {
    // 面板只注册一次
    if (this.layoutService.getTabbarHandler(CommentPanelId)) {
      return;
    }
    this.layoutService.collectTabbarComponent(
      [
        {
          id: CommentPanelId,
          component: CommentsPanel,
        },
      ],
      {
        badge: this.panelBadge,
        containerId: CommentPanelId,
        title: localize('comments').toUpperCase(),
        hidden: false,
        activateKeyBinding: 'ctrlcmd+shift+c',
        ...this.commentsFeatureRegistry.getCommentsPanelOptions(),
      },
      'bottom',
    );
  }

  get panelBadge() {
    const length = this.commentsThreads.length;
    return length ? length + '' : '';
  }

  registerCommentRangeProvider(id: string, provider: ICommentRangeProvider): IDisposable {
    this.rangeProviderMap.set(id, provider);
    // 注册一个新的 range provider 后清理掉之前的缓存
    this.providerDecorationCache.clear();
    return Disposable.create(() => {
      this.rangeProviderMap.delete(id);
      this.rangeOwner.delete(id);
      this.providerDecorationCache.clear();
    });
  }

  forceUpdateDecoration(): void {
    // 默认适应当前 uri 去强刷 decoration
    // 这个值为 core editor 或者 modified editor
    const uri = this.workbenchEditorService.currentEditor?.currentUri;
    uri && this.decorationChangeEmitter.fire(uri);
    // diffeditor 的 originalUri 也需要更新 Decoration
    const originalUri = this.workbenchEditorService.currentEditorGroup?.diffEditor?.originalEditor.currentUri;
    originalUri && this.decorationChangeEmitter.fire(originalUri);
  }

  public getProviderIdsByLine(line: number): string[] {
    const result: string[] = [];
    if (this.rangeOwner.size === 1) {
      // 只有一个provider，直接返回
      return [this.rangeOwner.keys().next().value];
    }
    for (const rangeOwner of this.rangeOwner) {
      const [id, ranges] = rangeOwner;
      if (ranges && ranges.some((range) => range.startLineNumber <= line && line <= range.endLineNumber)) {
        result.push(id);
      }
    }

    return result;
  }
}
