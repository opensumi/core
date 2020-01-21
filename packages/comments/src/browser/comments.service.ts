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
} from '../common';
import { CommentsThread } from './comments-thread';
import { observable, computed } from 'mobx';
import * as flattenDeep from 'lodash.flattendeep';
import * as groupBy from 'lodash.groupby';
import { dirname } from '@ali/ide-core-common/lib/path';

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

  private _decorationChange = new Emitter<URI>();

  @observable
  private threads = new Map<string, CommentsThread>();

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
    // 第一次必须要手动 fire
    this._decorationChange.fire(
      this.workbenchEditorService.currentResource?.uri!,
    );
  }

  public handleOnCreateEditor(editor: IEditor) {
    const ranges = this.getContributionRanges();
    if (ranges.length || this.threads.size) {
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
    return Disposable.NULL;
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
    });
    this.threads.set(thread.id, thread);
    this.addDispose(thread);
    return thread;
  }

  @computed
  get commentsTreeNodes(): ICommentsTreeNode[] {
    const commentThreads = [...this.threads.values()];
    const treeNodes: ICommentsTreeNode[] = [];
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
        ...firstThread.comments.length && {
          expanded: true,
          children: [],
        },
      };
      threads.forEach((thread) => {
        if (thread.comments.length === 0) {
          return;
        }
        const [ firstComment, ...otherComments ] = thread.comments;
        const firstCommentNode: ICommentsTreeNode = {
          id: firstComment.id,
          name: firstComment.author.name,
          description: firstComment.body,
          uri: thread.uri,
          parent: rootNode,
          depth: 1,
          thread,
          ...otherComments.length && {
            expanded: true,
            children: [],
          },
        };
        const firstCommentChildren = otherComments.map((comment) => {
          const otherCommentNode: ICommentsTreeNode = {
            id: comment.id,
            name: comment.author.name,
            description: comment.body,
            uri: thread.uri,
            parent: firstCommentNode,
            depth: 2,
            thread,
          };
          return otherCommentNode;
        });
        treeNodes.push(rootNode);
        treeNodes.push(firstCommentNode);
        treeNodes.push(...firstCommentChildren);
      });
    });
    return treeNodes;
  }

  private getContributionRanges(): IRange[] {
    const editor = this.workbenchEditorService.currentEditor!;
    const res = this.contributions.getContributions().map((contribution) => {
      return contribution.provideCommentingRanges(editor);
    });
    // 拍平，去掉 undefined
    return flattenDeep(res).filter(Boolean);
  }

  private registerDecorationProvider() {
    this.addDispose(
      this.editorDecorationCollectionService.registerDecorationProvider({
        schemes: ['file', 'git'],
        key: 'comments',
        onDidDecorationChange: this._decorationChange.event,
        provideEditorDecoration: (uri: URI) => {
          const decorations: monaco.editor.IModelDeltaDecoration[] = [];
          const ranges = this.getContributionRanges();
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
