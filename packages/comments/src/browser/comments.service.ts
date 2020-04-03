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
  ContributionProvider,
  AppConfig,
} from '@ali/ide-core-browser';
import { WorkbenchEditorService, IEditor, EditorType } from '@ali/ide-editor';
import { IEditorDecorationCollectionService } from '@ali/ide-editor/lib/browser';
import {
  ICommentsService,
  CommentGutterType,
  CommentsContribution,
  ICommentsThreadOptions,
  ICommentsThread,
  ICommentsTreeNode,
  ICommentsFeatureRegistry,
} from '../common';
import { CommentsThread } from './comments-thread';
import { observable, computed, action } from 'mobx';
import * as flattenDeep from 'lodash.flattendeep';
import * as groupBy from 'lodash.groupby';
import { dirname } from '@ali/ide-core-common/lib/path';
import { IIconService, IconType } from '@ali/ide-theme';

@Injectable()
export class CommentsService extends Disposable implements ICommentsService {

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(IEditorDecorationCollectionService)
  private readonly editorDecorationCollectionService: IEditorDecorationCollectionService;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired(CommentsContribution)
  private readonly contributions: ContributionProvider<CommentsContribution>;

  @Autowired(IIconService)
  iconService: IIconService;

  @Autowired(ICommentsFeatureRegistry)
  commentsFeatureRegistry: ICommentsFeatureRegistry;

  private decorationChangeEmitter = new Emitter<URI>();

  @observable.deep
  private threads = new Map<string, ICommentsThread>();

  private threadsChangeEmitter = new Emitter<ICommentsThread>();

  private threadsCreatedEmitter = new Emitter<ICommentsThread>();

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
      linesDecorationsClassName: this.getLinesDecorationsClassName(type),
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
    }`;
  }

  public init() {
    this.registerDecorationProvider();
  }

  public handleOnCreateEditor(editor: IEditor) {
    const disposer = new Disposable();
    const editorOptions = editor.getType() === EditorType.CODE ? {
      lineNumbersMinChars: 3,
      lineDecorationsWidth: '1.5ch',
    } : {
      lineNumbersMinChars: 5,
      lineDecorationsWidth: '3ch',
    };
    editor.monacoEditor.updateOptions(editorOptions);
    // 绑定点击事件
    disposer.addDispose(this.bindClickGutterEvent(editor));
    return disposer;
  }

  // 绑定点击 gutter 事件
  private bindClickGutterEvent(editor: IEditor) {
    const dispose = editor.monacoEditor.onMouseDown((event) => {
      if (
        event.target.type ===
          monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS &&
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
      .sort((a, b) => a.range.startLineNumber -  b.range.startLineNumber);
  }

  @action
  public forceUpdateTreeNodes() {
    this.forceUpdateCount++;
  }

  @computed
  get commentsTreeNodes(): ICommentsTreeNode[] {
    let treeNodes: ICommentsTreeNode[] = [];
    const commentThreads = [...this.threads.values()];
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
        const [ firstComment, ...otherComments ] = thread.comments;
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

  private async getContributionRanges(): Promise<IRange[]> {
    const editor = this.workbenchEditorService.currentEditor!;
    const res = await Promise.all(this.contributions.getContributions().map((contribution) => {
      return contribution.provideCommentingRanges(editor);
    }));
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
          const ranges = await this.getContributionRanges();
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
}
