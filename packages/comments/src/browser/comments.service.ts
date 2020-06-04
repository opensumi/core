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
} from '@ali/ide-core-browser';
import { IEditor } from '@ali/ide-editor';
import { IEditorDecorationCollectionService, IEditorDocumentModelService, WorkbenchEditorService } from '@ali/ide-editor/lib/browser';
import {
  ICommentsService,
  CommentGutterType,
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

  @observable
  private forceUpdateCount = 0;

  @computed
  get commentsThreads() {
    return [...this.threads.values()];
  }

  get onThreadsChanged() {
    return this.threadsChangeEmitter.event;
  }

  get onThreadsCreated() {
    return this.threadsCreatedEmitter.event;
  }

  private createDecoration(
    type: CommentGutterType,
  ): monaco.textModel.ModelDecorationOptions {
    const decorationOptions: monaco.editor.IModelDecorationOptions = {
      glyphMarginClassName: this.getLinesDecorationsClassName(type),
      isWholeLine: true,
      // stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
    };
    return monaco.textModel.ModelDecorationOptions.createDynamic(
      decorationOptions,
    );
  }

  private getLinesDecorationsClassName(type: CommentGutterType) {
    return `comments-glyph ${
      type === CommentGutterType.Empty
        ? 'comment-diff-added'
        : 'comment-thread'
      } ` + getIcon('message');
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
        event.target.type ===
        monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN &&
        event.target.element &&
        event.target.element.className.indexOf('comments-glyph') > -1
      ) {
        const { target } = event;
        const { element } = target;
        if (target && element && target.range) {
          const { range } = target;
          const threadId = CommentsThread.getId(editor.currentUri!, range);
          const thread = this.threads.get(threadId);
          if (!thread) {
            const thread = this.createThread(editor.currentUri!, range);
            const element = event.target.element;
            element.classList.remove('comment-diff-added');
            element.classList.add('comment-thread');
            thread.onDispose(() => {
              element.classList.remove('comment-thread');
              element.classList.add('comment-diff-added');
            });
            thread.show();
          } else {
            thread.toggle(editor);
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
    const model = this.documentService.getModelReference(uri);
    const rangePromise: Promise<IRange[] | undefined>[] = [];
    for (const rangeProvider of this.rangeProviderMap) {
      const [id, provider] = rangeProvider;
      rangePromise.push((async () => {
        const ranges = await provider.getCommentingRanges(model?.instance!);
        if (ranges && ranges.length) {
          this.rangeOwner.set(id, ranges);
        }
        return ranges;
      })());
    }
    const res = await Promise.all(rangePromise);
    // 消除 document 引用
    model?.dispose();
    // 拍平，去掉 undefined
    return flattenDeep(res).filter(Boolean);
  }

  private registerDecorationProvider() {
    this.addDispose(
      this.editorDecorationCollectionService.registerDecorationProvider({
        schemes: ['file', 'git'],
        key: 'comments',
        onDidDecorationChange: this.decorationChangeEmitter.event,
        provideEditorDecoration: async (uri: URI) => {
          const decorations: monaco.editor.IModelDeltaDecoration[] = [];
          const ranges = await this.getContributionRanges(uri);
          if (ranges && ranges.length) {
            decorations.push(
              ...ranges.map((range) => ({
                range,
                options: this.createDecoration(
                  CommentGutterType.Empty,
                ),
              })),
            );
          }
          if (this.threads.size) {
            const threads = [...this.threads.values()]
              // 先隐藏上一个 thread，否则同组会显示已经有这个 widgetId
              .map((thread) => {
                if (!thread.uri.isEqual(uri)) {
                  thread.hide();
                }
                return thread;
              })
              .filter((thread) => {
                const isCurrentThread = thread.uri.isEqual(uri);
                if (isCurrentThread) {
                  // 恢复之前的现场
                  thread.show();
                }
                return isCurrentThread;
              });
            decorations.push(
              ...threads.map((thread) => {
                return {
                  range: thread.range,
                  options: this.createDecoration(
                    CommentGutterType.Thread,
                  ),
                };
              }),
            );
          }

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
