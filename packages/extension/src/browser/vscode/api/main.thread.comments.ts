import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  ICommentsService,
  ICommentsThread,
  ICommentsFeatureRegistry,
  CommentMode,
  CommentReactionClick,
  IThreadComment,
  CommentReaction,
} from '@opensumi/ide-comments';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import {
  IRange,
  Emitter,
  Event,
  URI,
  CancellationToken,
  IDisposable,
  positionToRange,
  isUndefined,
  Disposable,
  WithEventBus,
  OnEvent,
} from '@opensumi/ide-core-common';
import {
  CommentThread,
  CommentInput,
  CommentReaction as CoreCommentReaction,
  CommentMode as CoreCommentMode,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes';

import {
  IMainThreadComments,
  CommentProviderFeatures,
  IExtHostComments,
  IMainThreadCommands,
} from '../../../common/vscode';
import { ExtHostAPIIdentifier } from '../../../common/vscode';
import {
  UriComponents,
  CommentThreadCollapsibleState,
  Comment as CoreComment,
  CommentThreadChanges,
} from '../../../common/vscode/models';

@Injectable({ multiple: true })
export class MainthreadComments implements IDisposable, IMainThreadComments {
  @Autowired(ICommentsService)
  private commentsService: ICommentsService;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  private proxy: IExtHostComments;

  private _providers = new Map<string, number>();

  private _commentControllers = new Map<number, MainThreadCommentController>();

  private disposable = new Disposable();

  constructor(private rpcProtocol: IRPCProtocol, private mainThreadCommands: IMainThreadCommands) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostComments);
    this.disposable.addDispose(this.registerCommentThreadTemplateHander());
    this.disposable.addDispose(this.registerArgumentProcessor());
  }

  private registerCommentThreadTemplateHander() {
    return this.commentsService.onThreadsCreated(async (thread) => {
      // 说明是点击左侧 decoration 创建的，需要在插件进程常见对应的临时评论
      // 插件主动创建的默认有 data
      if (isUndefined(thread.data)) {
        // 可能当前行的 provider 有很多，参考 vscode 获取第一个
        const providerId = this.commentsService.getProviderIdsByLine(thread.range.startLineNumber)[0];
        if (providerId) {
          const handle = this._providers.get(providerId);
          // 说明这个评论是模块创建的
          if (isUndefined(handle)) {
            return;
          }
          const commentController = this._commentControllers.get(handle!);
          if (!commentController) {
            throw new Error('unknown controller');
          }
          // 创建一个临时的评论
          commentController.createCommentThreadTemplate(thread.uri.codeUri, thread.range);
        }
      }
    });
  }

  private registerArgumentProcessor() {
    return this.mainThreadCommands.registerArgumentProcessor({
      processArgument: (arg: any) => {
        if (!arg || !arg.menuId || !arg.thread || isUndefined(arg.thread.data)) {
          return arg;
        }
        switch (arg.menuId) {
          case MenuId.CommentsCommentThreadTitle:
            return {
              $mid: 7,
              commentControlHandle: arg.thread.data.commentControlHandle,
              commentThreadHandle: arg.thread.data.commentThreadHandle,
            };
          case MenuId.CommentsCommentThreadContext:
            return {
              $mid: 8,
              thread: {
                commentControlHandle: arg.thread.data.commentControlHandle,
                commentThreadHandle: arg.thread.data.commentThreadHandle,
              },
              text: arg.text,
            };
          case MenuId.CommentsCommentTitle:
            return {
              $mid: 9,
              thread: {
                commentControlHandle: arg.thread.data.commentControlHandle,
                commentThreadHandle: arg.thread.data.commentThreadHandle,
              },
              // commentUniqueId 为 number 类型
              commentUniqueId: +arg.comment.id,
            };
          case MenuId.CommentsCommentContext:
            return {
              $mid: 10,
              thread: {
                commentControlHandle: arg.thread.data.commentControlHandle,
                commentThreadHandle: arg.thread.data.commentThreadHandle,
              },
              // commentUniqueId 为 number 类型
              commentUniqueId: +arg.comment.id,
              text: arg.body,
            };
          default:
            return arg;
        }
      },
    });
  }

  $updateCommentThread(
    handle: number,
    commentThreadHandle: number,
    threadId: string,
    resource: UriComponents,
    changes: Partial<{
      range: IRange;
      label: string;
      contextValue: string;
      comments: CoreComment[];
      collapseState: CommentThreadCollapsibleState;
    }>,
  ): void {
    const provider = this._commentControllers.get(handle);
    if (!provider) {
      return undefined;
    }
    return provider.updateCommentThread(commentThreadHandle, threadId, resource, changes);
  }
  $registerCommentController(handle: number, id: string, label: string): void {
    this.commentsService.registerCommentPanel();
    this._providers.set(id, handle);
    const provider = this.injector.get(MainThreadCommentController, [this.proxy, handle, id, label, {}]);

    this._commentControllers.set(handle, provider);
    // 注册后触发 decoration
    this.commentsService.forceUpdateDecoration();

    this.disposable.addDispose(
      Disposable.create(() => {
        this.$unregisterCommentController(handle);
      }),
    );
  }
  $updateCommentControllerFeatures(handle: number, features: CommentProviderFeatures): void {
    const provider = this._commentControllers.get(handle);
    if (!provider) {
      return undefined;
    }
    provider.updateFeatures(features);
  }
  $unregisterCommentController(handle: number): void {
    const provider = this._commentControllers.get(handle);
    // 销毁注册的 thread
    if (provider) {
      provider.dispose();
      this._providers.delete(provider.id);
    }
    this._commentControllers.delete(handle);
  }
  $createCommentThread(
    handle: number,
    commentThreadHandle: number,
    threadId: string,
    resource: UriComponents,
    range: IRange,
    extensionId: string,
  ): CommentThread | undefined {
    const provider = this._commentControllers.get(handle);
    if (!provider) {
      return undefined;
    }
    return provider.createCommentThread(extensionId, commentThreadHandle, threadId, resource, range);
  }
  $deleteCommentThread(handle: number, commentThreadHandle: number): void {
    const provider = this._commentControllers.get(handle);
    if (!provider) {
      return;
    }
    return provider.deleteCommentThread(commentThreadHandle);
  }

  dispose(): void {
    this.disposable.dispose();
    this._commentControllers.clear();
  }
}

@Injectable({ multiple: true })
export class MainThreadCommentThread implements CommentThread {
  @Autowired(ICommentsService)
  private commentsService: ICommentsService;

  private _input?: CommentInput;
  get input(): CommentInput | undefined {
    return this._input;
  }

  set input(value: CommentInput | undefined) {
    this._input = value;
    this._onDidChangeInput.fire(value);
  }

  private readonly _onDidChangeInput = new Emitter<CommentInput | undefined>();
  get onDidChangeInput(): Event<CommentInput | undefined> {
    return this._onDidChangeInput.event;
  }

  get label(): string | undefined {
    return this._thread.label;
  }

  set label(label: string | undefined) {
    this._thread.label = label;
    this._onDidChangeLabel.fire(label);
  }

  get contextValue(): string | undefined {
    return this._thread.contextValue;
  }

  set contextValue(context: string | undefined) {
    this._thread.contextValue = context;
  }

  private readonly _onDidChangeLabel = new Emitter<string | undefined>();
  readonly onDidChangeLabel: Event<string | undefined> = this._onDidChangeLabel.event;

  public convertToIThreadComment(comment: CoreComment): IThreadComment {
    return {
      id: comment.uniqueIdInThread.toString(),
      mode: comment.mode as unknown as CommentMode,
      body: comment.body.value,
      label: comment.label,
      contextValue: comment.contextValue,
      author: {
        name: comment.userName,
        iconPath: comment.userIconPath,
      },
      reactions: comment.commentReactions?.map((reaction) => this.convertToCommentReaction(reaction)),
    };
  }

  public convertToCommentReaction(reaction: CoreCommentReaction): CommentReaction {
    const { label, iconPath, count, hasReacted } = reaction;
    return {
      label,
      iconPath: new URI(URI.revive(iconPath)),
      count: count ?? 0,
      authorHasReacted: !!hasReacted,
    };
  }

  public convertToCoreReaction(reaction: CommentReaction): CoreCommentReaction {
    const { label, iconPath, count, authorHasReacted } = reaction;
    return {
      label,
      iconPath: URI.revive(iconPath),
      count: count ?? 0,
      hasReacted: authorHasReacted,
    };
  }

  public convertToCoreComment(comment: IThreadComment): CoreComment {
    return {
      uniqueIdInThread: +comment.id,
      contextValue: comment.contextValue,
      mode: comment.mode as unknown as CoreCommentMode,
      label: typeof comment.label === 'string' ? comment.label : '',
      body: {
        value: comment.body,
      },
      userName: comment.author.name,
      commentReactions: comment.reactions?.map((reaction) => this.convertToCoreReaction(reaction)),
    };
  }

  public get comments(): CoreComment[] | undefined {
    return this._thread.comments.map((comment) => this.convertToCoreComment(comment));
  }

  public set comments(newComments: CoreComment[] | undefined) {
    if (newComments) {
      this._thread.comments = newComments.map((comment) => this.convertToIThreadComment(comment));
    } else {
      this._thread.comments = [];
    }

    this._onDidChangeComments.fire(newComments);
  }

  private readonly _onDidChangeComments = new Emitter<CoreComment[] | undefined>();
  get onDidChangeComments(): Event<CoreComment[] | undefined> {
    return this._onDidChangeComments.event;
  }

  set range(range: IRange) {
    this._thread.range = range;
    this._onDidChangeRange.fire(this._thread.range);
  }

  get range(): IRange {
    return this._thread.range;
  }

  private readonly _onDidChangeCanReply = new Emitter<boolean>();
  get onDidChangeCanReply(): Event<boolean> {
    return this._onDidChangeCanReply.event;
  }
  set canReply(state: boolean) {
    this._thread.readOnly = !state;
    this._onDidChangeCanReply.fire(state);
  }

  get canReply() {
    return !this._thread.readOnly;
  }

  private readonly _onDidChangeRange = new Emitter<IRange>();
  public onDidChangeRange = this._onDidChangeRange.event;

  private _collapsibleState: CommentThreadCollapsibleState | undefined;
  get collapsibleState() {
    return this._thread.isCollapsed ? CommentThreadCollapsibleState.Collapsed : CommentThreadCollapsibleState.Expanded;
  }

  set collapsibleState(newState: CommentThreadCollapsibleState | undefined) {
    this._thread.isCollapsed = newState === CommentThreadCollapsibleState.Collapsed;
    this._onDidChangeCollasibleState.fire(this._collapsibleState);
  }

  private readonly _onDidChangeCollasibleState = new Emitter<CommentThreadCollapsibleState | undefined>();
  public onDidChangeCollasibleState = this._onDidChangeCollasibleState.event;

  private _isDisposed: boolean;

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  private _thread: ICommentsThread;

  constructor(
    public commentThreadHandle: number,
    public controllerHandle: number,
    public extensionId: string,
    public threadId: string,
    public resource: string,
    _range: IRange,
    _canReply: boolean,
  ) {
    // 查找当前位置 的 threads
    // 框架支持同一个位置多个 thread
    const threads = this.commentsService.commentsThreads.filter(
      (commentThread) =>
        commentThread.uri.toString() === resource && commentThread.range.startLineNumber === _range.startLineNumber,
    );
    // 取最后一个 thread，因为新建的评论在最后一个位置
    const [thread] = threads.slice(-1);
    // 在 data 字段保存 handle id
    const threadData = {
      commentControlHandle: controllerHandle,
      commentThreadHandle,
    };

    // 说明是点击 decoration 新建的 thread
    if (thread && !thread.data) {
      thread.data = threadData;
      this._thread = thread;
    } else {
      this._thread = this.commentsService.createThread(new URI(resource), positionToRange(_range.startLineNumber), {
        data: threadData,
        readOnly: !_canReply,
      });
    }
    this._isDisposed = false;
  }

  batchUpdate(changes: CommentThreadChanges) {
    const modified = (value: keyof CommentThreadChanges): boolean =>
      Object.prototype.hasOwnProperty.call(changes, value);

    if (modified('range')) {
      this.range = changes.range!;
    }
    if (modified('label')) {
      this.label = changes.label;
    }
    if (modified('contextValue')) {
      this.contextValue = changes.contextValue;
    }
    if (modified('comments')) {
      this.comments = changes.comments;
    }
    if (modified('collapseState')) {
      this.collapsibleState = changes.collapseState;
    }
    if (modified('canReply')) {
      this.canReply = changes.canReply!;
    }
  }

  dispose() {
    this._isDisposed = true;
    this._onDidChangeCollasibleState.dispose();
    this._onDidChangeComments.dispose();
    this._onDidChangeInput.dispose();
    this._onDidChangeLabel.dispose();
    this._onDidChangeRange.dispose();
    this._thread.dispose();
  }

  toJSON(): any {
    return {
      $mid: 7,
      commentControlHandle: this.controllerHandle,
      commentThreadHandle: this.commentThreadHandle,
    };
  }
}

@Injectable({ multiple: true })
export class MainThreadCommentController extends WithEventBus {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(ICommentsService)
  private commentsService: ICommentsService;

  @Autowired(ICommentsFeatureRegistry)
  private readonly commentsFeatureRegistry: ICommentsFeatureRegistry;

  get handle(): number {
    return this._handle;
  }

  get id(): string {
    return this._id;
  }

  get contextValue(): string {
    return this._id;
  }

  get proxy(): IExtHostComments {
    return this._proxy;
  }

  get label(): string {
    return this._label;
  }

  private _reactions: CoreCommentReaction[] | undefined;

  get reactions() {
    return this._reactions;
  }

  set reactions(reactions: CoreCommentReaction[] | undefined) {
    this._reactions = reactions;
  }

  private readonly _threads: Map<number, MainThreadCommentThread> = new Map<number, MainThreadCommentThread>();
  public activeCommentThread?: MainThreadCommentThread;

  get features(): CommentProviderFeatures {
    return this._features;
  }

  constructor(
    private readonly _proxy: IExtHostComments,
    private readonly _handle: number,
    private readonly _id: string,
    private readonly _label: string,
    private _features: CommentProviderFeatures,
  ) {
    super();
    this.addDispose(
      this.commentsService.registerCommentRangeProvider(_id, {
        getCommentingRanges: (documentModel) => this.getCommentingRanges(documentModel.uri, CancellationToken.None),
      }),
    );
  }

  updateFeatures(features: CommentProviderFeatures) {
    this._features = {
      ...this._features,
      ...features,
    };

    this.commentsFeatureRegistry.registerProviderFeature(this._id, {
      placeholder: this._features.options?.placeHolder,
    });
  }

  createCommentThread(
    extensionId: string,
    commentThreadHandle: number,
    threadId: string,
    resource: UriComponents,
    range: IRange,
  ): CommentThread {
    const uri = URI.from(resource);
    const thread = this.injector.get(MainThreadCommentThread, [
      commentThreadHandle,
      this.handle,
      extensionId,
      threadId,
      uri.toString(),
      range,
      true,
    ]);

    this._threads.set(commentThreadHandle, thread);
    this.addDispose({
      dispose: () => {
        this._threads.delete(commentThreadHandle);
        thread.dispose();
      },
    });

    return thread;
  }

  updateCommentThread(
    commentThreadHandle: number,
    _threadId: string,
    _resource: UriComponents,
    changes: CommentThreadChanges,
  ): void {
    const thread = this.getKnownThread(commentThreadHandle);
    thread.batchUpdate(changes);
  }

  deleteCommentThread(commentThreadHandle: number) {
    const thread = this.getKnownThread(commentThreadHandle);
    this._threads.delete(commentThreadHandle);

    thread.dispose();
  }

  deleteCommentThreadMain(commentThreadId: string) {
    this._threads.forEach((thread) => {
      if (thread.threadId === commentThreadId) {
        this._proxy.$deleteCommentThread(this._handle, thread.commentThreadHandle);
      }
    });
  }

  private getKnownThread(commentThreadHandle: number): MainThreadCommentThread {
    const thread = this._threads.get(commentThreadHandle);
    if (!thread) {
      throw new Error('unknown thread');
    }
    return thread;
  }

  async getCommentingRanges(resource: URI, token: CancellationToken): Promise<IRange[]> {
    const commentingRanges = await this._proxy.$provideCommentingRanges(this.handle, resource.codeUri, token);
    return commentingRanges || [];
  }

  @OnEvent(CommentReactionClick)
  handleCommentReaction(e: CommentReactionClick) {
    const { thread, comment, reaction } = e.payload;
    const threadHandle = thread.data?.commentThreadHandle;
    const mainThread = this.getKnownThread(threadHandle);
    const coreComment = mainThread.convertToCoreComment(comment);
    const coreReaction = mainThread.convertToCoreReaction(reaction);

    this.toggleReaction(thread.uri, mainThread, coreComment, coreReaction);
  }

  async toggleReaction(
    uri: URI,
    thread: CommentThread,
    comment: CoreComment,
    reaction: CoreCommentReaction,
  ): Promise<void> {
    return this._proxy.$toggleReaction(this._handle, thread.commentThreadHandle, uri.codeUri, comment, reaction);
  }

  createCommentThreadTemplate(resource: UriComponents, range: IRange): void {
    this._proxy.$createCommentThreadTemplate(this.handle, resource, range);
  }

  async updateCommentThreadTemplate(threadHandle: number, range: IRange) {
    await this._proxy.$updateCommentThreadTemplate(this.handle, threadHandle, range);
  }

  toJSON(): any {
    return {
      $mid: 6,
      handle: this.handle,
    };
  }
}
