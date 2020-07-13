import {
  INJECTOR_TOKEN,
  Injector,
  Injectable,
  Autowired,
} from '@ali/common-di';
import {
  Disposable,
  IRange,
  URI,
  Emitter,
  AppConfig,
  localize,
  IDisposable,
  getIcon,
  positionToRange,
  Event,
  memoize,
} from '@ali/ide-core-browser';
import { IEditor } from '@ali/ide-editor';
import { IEditorDecorationCollectionService, IEditorDocumentModelService, WorkbenchEditorService } from '@ali/ide-editor/lib/browser';
import {
  ICommentsService,
  ICommentsThreadOptions,
  ICommentsThread,
  ICommentsTreeNode,
  ICommentsFeatureRegistry,
  CommentPanelId,
  ICommentRangeProvider,
} from '../common';
import { CommentsThread } from './comments-thread';
import { observable, computed, action } from 'mobx';
import * as flattenDeep from 'lodash.flattendeep';
import * as groupBy from 'lodash.groupby';
import { dirname } from '@ali/ide-core-common/lib/path';
import { IIconService, IconType } from '@ali/ide-theme';
import { CommentsPanel } from './comments-panel.view';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { LRUCache } from '@ali/ide-core-common/lib/map';

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

  @Autowired(ICommentsFeatureRegistry)
  private readonly commentsFeatureRegistry: ICommentsFeatureRegistry;

  @Autowired(IEditorDocumentModelService)
  private readonly documentService: IEditorDocumentModelService;

  @Autowired(IMainLayoutService)
  private readonly layoutService: IMainLayoutService;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  private decorationChangeEmitter = new Emitter<URI>();

  @observable
  private threads = new Map<string, ICommentsThread>();

  private threadsChangeEmitter = new Emitter<ICommentsThread>();

  private threadsCreatedEmitter = new Emitter<ICommentsThread>();

  private rangeProviderMap = new Map<string, ICommentRangeProvider>();

  private rangeOwner = new Map<string, IRange[]>();

  private providerDecorationCache = new LRUCache<string, IRange[]>(10000);

  @observable
  private forceUpdateCount = 0;

  @computed
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

  get onThreadsCreated(): Event<ICommentsThread> {
    return this.threadsCreatedEmitter.event;
  }

  private createThreadDecoration(thread: ICommentsThread) {
    // 对于新增的空的 thread，默认显示当前用户的头像，否则使用第一个用户的头像
    const avatar = thread.comments.length === 0 ? this.currentAuthorAvatar : thread.comments[0].author.iconPath?.toString();
    const icon = avatar ? this.iconService.fromIcon('', avatar, IconType.Background) : getIcon('message');
    const decorationOptions: monaco.editor.IModelDecorationOptions = {
      // 创建评论显示在 glyph margin 处
      glyphMarginClassName: ['comments-decoration', 'comments-thread', icon].join(' '),
    };
    return monaco.textModel.ModelDecorationOptions.createDynamic(
      decorationOptions,
    );
  }

  private createBeforeDecoration(): monaco.textModel.ModelDecorationOptions {
    const decorationOptions: monaco.editor.IModelDecorationOptions = {
      // 评论组件跟随鼠标移动显示
      beforeContentClassName: ['comments-decoration', 'comments-add', getIcon('message')].join(' '),
    };
    return monaco.textModel.ModelDecorationOptions.createDynamic(
      decorationOptions,
    );
  }

  public init() {
    this.registerDecorationProvider();
  }

  public handleOnCreateEditor(editor: IEditor) {
    return this.bindClickGutterEvent(editor);
  }

  // 绑定点击 gutter 事件
  private bindClickGutterEvent(editor: IEditor) {
    const dispose = editor.monacoEditor.onMouseDown((event) => {
      if (
        (
          event.target.type === monaco.editor.MouseTargetType.CONTENT_TEXT
          || event.target.type === monaco.editor.MouseTargetType.CONTENT_EMPTY
        )
        && event.target.element
        && event.target.element.className.indexOf('comments-add') > -1
      ) {
        const { target } = event;
        if (target && target.range) {
          const { range } = target;
          const thread = this.createThread(editor.currentUri!, range);
          thread.show(editor);
        }
      } else if (
        event.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN
        && event.target.element
        && event.target.element.className.indexOf('comments-thread') > -1
      ) {
        const { target } = event;
        if (target && target.range) {
          const { range } = target;
          const threads = this.commentsThreads
            .filter((thread) => thread.uri.isEqual(editor.currentUri!) && thread.range.startLineNumber === range.startLineNumber);
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
      }
    });
    this.addDispose(dispose);
    return dispose;
  }

  public createThread(
    uri: URI,
    range: IRange,
    options: ICommentsThreadOptions = {
      comments: [],
      readOnly: false,
    },
  ) {
    const thread = this.injector.get(CommentsThread, [uri, range, options]);
    thread.onDispose(() => {
      this.threads.delete(thread.id);
      this.threadsChangeEmitter.fire(thread);
      this.decorationChangeEmitter.fire(uri);
    });
    this.threads.set(thread.id, thread);
    this.addDispose(thread);
    this.threadsChangeEmitter.fire(thread);
    this.threadsCreatedEmitter.fire(thread);
    this.decorationChangeEmitter.fire(uri);
    return thread;
  }

  public getThreadsByUri(uri: URI) {
    return this.commentsThreads
      .filter((thread) => thread.uri.isEqual(uri))
      // 默认按照 rang 顺序 升序排列
      .sort((a, b) => a.range.startLineNumber - b.range.startLineNumber);
  }

  @action
  public forceUpdateTreeNodes() {
    this.forceUpdateCount++;
  }

  @computed
  get commentsTreeNodes(): ICommentsTreeNode[] {
    let treeNodes: ICommentsTreeNode[] = [];
    const commentThreads = [...this.threads.values()].filter((thread) => thread.comments.length);
    const threadUris = groupBy(commentThreads, (thread: ICommentsThread) => thread.uri);
    Object.keys(threadUris).forEach((uri) => {
      const threads: ICommentsThread[] = threadUris[uri];
      if (threads.length === 0) {
        return;
      }
      const firstThread = threads[0];
      const firstThreadUri = firstThread.uri;
      const filePath = dirname(firstThreadUri.path.toString().replace(this.appConfig.workspaceDir, ''));
      const rootNode: ICommentsTreeNode = {
        id: uri,
        name: firstThreadUri.displayName,
        uri: firstThreadUri,
        description: filePath.replace(/^\//, ''),
        parent: undefined,
        thread: firstThread,
        ...threads.length && {
          expanded: true,
          children: [],
        },
        // 跳过 mobx computed， 强制在走一次 getCommentsPanelTreeNodeHandlers 逻辑
        _forceUpdateCount: this.forceUpdateCount,
      };
      treeNodes.push(rootNode);
      threads.forEach((thread) => {
        if (thread.comments.length === 0) {
          return;
        }
        const [firstComment, ...otherComments] = thread.comments;
        const firstCommentNode: ICommentsTreeNode = {
          id: firstComment.id,
          name: firstComment.author.name,
          iconStyle: {
            marginRight: 5,
            backgroundSize: '14px 14px',
          },
          icon: this.iconService.fromIcon('', firstComment.author.iconPath?.toString(), IconType.Background),
          description: firstComment.body,
          uri: thread.uri,
          parent: rootNode,
          depth: 1,
          thread,
          ...otherComments.length && {
            expanded: true,
            children: [],
          },
          comment: firstComment,
        };
        const firstCommentChildren = otherComments.map((comment) => {
          const otherCommentNode: ICommentsTreeNode = {
            id: comment.id,
            name: comment.author.name,
            description: comment.body,
            uri: thread.uri,
            iconStyle: {
              marginRight: 5,
              backgroundSize: '14px 14px',
            },
            icon: this.iconService.fromIcon('', comment.author.iconPath?.toString(), IconType.Background),
            parent: firstCommentNode,
            depth: 2,
            thread,
            comment,
          };
          return otherCommentNode;
        });
        treeNodes.push(firstCommentNode);
        treeNodes.push(...firstCommentChildren);
      });
    });

    for (const handler of this.commentsFeatureRegistry.getCommentsPanelTreeNodeHandlers()) {
      treeNodes = handler(treeNodes);
    }

    return treeNodes;
  }

  private async getContributionRanges(uri: URI): Promise<IRange[]> {
    const cache = this.providerDecorationCache.get(uri.toString());
    // 优先从缓存中拿
    if (cache) {
      return cache;
    }

    const model = this.documentService.getModelReference(uri);
    const rangePromise: Promise<IRange[] | undefined>[] = [];
    for (const rangeProvider of this.rangeProviderMap) {
      const [id, provider] = rangeProvider;
      rangePromise.push((async () => {
        const ranges = await provider.getCommentingRanges(model?.instance!);
        /**
         * 如果在编辑器内显示，需要使用 beforeContntClassName
         * 但是他只识别 startLineNumber
         * 所以将 Range 拆开，拆成一个一个 startLineNumber 和 endLineNumber 相等的 decoration
         */
        const commentingRanges = ranges?.reduce<IRange[]>((pre, cur) => {
          return pre.concat(Array(cur.endLineNumber - cur.startLineNumber + 1).fill(0).map((_, index) => positionToRange(cur.startLineNumber + index)));
        }, []);
        if (commentingRanges && commentingRanges.length) {
          this.rangeOwner.set(id, commentingRanges);
        }
        return commentingRanges;
      })());
    }
    const res = await Promise.all(rangePromise);
    // 消除 document 引用
    model?.dispose();
    // 拍平，去掉 undefined
    const flattenRange: IRange[] = flattenDeep(res).filter(Boolean);
    this.providerDecorationCache.set(uri.toString(), flattenRange);
    return flattenRange;
  }

  private registerDecorationProvider() {
    this.addDispose(
      this.editorDecorationCollectionService.registerDecorationProvider({
        schemes: ['file', 'git'],
        key: 'comments',
        onDidDecorationChange: this.decorationChangeEmitter.event,
        provideEditorDecoration: async (uri: URI) => {
          const threads = [...this.threads.values()];
          const decorations: monaco.editor.IModelDeltaDecoration[] = [];
          const ranges = await this.getContributionRanges(uri);
          // 设置新增评论的 decoration
          decorations.push(
            ...ranges
              .filter((range) =>
                this.isMultiCommentsForSingleLine ? true :
                // 如果不支持对同一行进行多个评论，那么过滤掉当前有 thread 行号的 beforeDecoration
                !threads.some((thread) =>
                  thread.uri.isEqual(uri)
                  && thread.range.startLineNumber === range.startLineNumber,
                ),
              )
              .map((range) => ({
                range,
                options: this.createBeforeDecoration(),
              })),
          );
          // 设置已有评论的 decoration
          decorations.push(
            ...threads
              .map((thread) => {
                if (thread.uri.isEqual(uri) && thread.isShowWidget()) {
                  // 恢复之前的现场
                  thread.show();
                } else {
                  // 设置为 dispose 方式消失，不会修改内部 isShow 变量，用这个变量来判断下次且回来后是否要恢复显示
                  thread.hideAll(true);
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
              .map((thread) => {
                return {
                  range: thread.range,
                  options: this.createThreadDecoration(thread),
                };
              }),
          );

          return decorations;
        },
      }),
    );
  }

  public registerCommentPanel() {
    // 面板只注册一次
    if (this.layoutService.getTabbarHandler(CommentPanelId)) {
      return;
    }
    this.layoutService.collectTabbarComponent([{
      id: CommentPanelId,
      component: CommentsPanel,
    }], {
      badge: this.panelBadge,
      containerId: CommentPanelId,
      title: localize('comments').toUpperCase(),
      hidden: false,
      activateKeyBinding: 'shift+ctrlcmd+c',
      ...this.commentsFeatureRegistry.getCommentsPanelOptions(),
    }, 'bottom');
  }

  get panelBadge() {
    const length = this.commentsThreads.length;
    return length ? length + '' : '';
  }

  registerCommentRangeProvider(id: string, provider: ICommentRangeProvider): IDisposable {
    this.rangeProviderMap.set(id, provider);
    return Disposable.create(() => {
      this.rangeProviderMap.delete(id);
    });
  }

  forceUpdateDecoration(): void {
    // 默认适应当前 uri 去强刷 decoration
    const uri = this.workbenchEditorService.currentEditor?.currentUri;
    uri && this.decorationChangeEmitter.fire(uri);
  }

  public getProviderIdsByLine(line: number): string[] {
    const result: string[] = [];
    for (const rangeOwner of this.rangeOwner) {
      const [id, ranges] = rangeOwner;
      if (ranges && ranges.some((range) => range.startLineNumber <= line && line <= range.endLineNumber)) {
        result.push(id);
      }
    }

    return result;
  }
}
