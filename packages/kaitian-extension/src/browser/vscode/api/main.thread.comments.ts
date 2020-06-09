import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { UriComponents, CommentThread, CommentThreadCollapsibleState, Comment, CommentThreadChanges } from '../../../common/vscode/models';
import { IRange, Emitter, Event, URI, CancellationToken, IDisposable, positionToRange, isUndefined, Disposable } from '@ali/ide-core-common';
import { IMainThreadComments, CommentProviderFeatures, IExtHostComments, IMainThreadCommands } from '../../../common/vscode';
import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier } from '../../../common/vscode';
import * as modes from '../../../common/vscode/models';
import { ICommentsService, ICommentsThread, IThreadComment } from '@ali/ide-comments';
import { MenuId } from '@ali/ide-core-browser/lib/menu/next';

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

  constructor(
    private rpcProtocol: IRPCProtocol,
    private mainThreadCommands: IMainThreadCommands,
  ) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostComments);
    this.disposable.addDispose(this.registerCommentThreadTemplateHander());
    this.disposable.addDispose(this.registerArgumentProcessor());
  }

  private registerCommentThreadTemplateHander() {
    return this.commentsService.onThreadsChanged(async (thread) => {
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
          const commentController = this._commentControllers.get(handle);
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
        if (!arg || !arg.menuId) {
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
          default: return arg;
        }
      },
    });
  }

  $updateCommentThread(handle: number, commentThreadHandle: number, threadId: string, resource: UriComponents, changes: Partial<{ range: IRange; label: string; contextValue: string; comments: Comment[]; collapseState: CommentThreadCollapsibleState; }>): void {
    const provider = this._commentControllers.get(handle);
    if (!provider) {
      return undefined;
    }
    return provider.updateCommentThread(commentThreadHandle, threadId, resource, changes);
  }
  $registerCommentController(handle: number, id: string, label: string): void {
    this.commentsService.registerCommentPanel();
    const providerId = `ext_comment_controller_${id}`;
    this._providers.set(providerId, handle);
    const provider = this.injector.get(MainThreadCommentController, [this.proxy, handle, providerId, id, label, {}]);
    this.disposable.addDispose(provider);
    this._commentControllers.set(handle, provider);
    // 注册后触发 decoration
    this.commentsService.forceUpdateDecoration();
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
      this._providers.delete(provider.uniqueId);
    }
    this._commentControllers.delete(handle);
  }
  $createCommentThread(handle: number, commentThreadHandle: number, threadId: string, resource: UriComponents, range: IRange, extensionId: string): CommentThread | undefined {
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

  private _input?: modes.CommentInput;
  get input(): modes.CommentInput | undefined {
    return this._input;
  }

  set input(value: modes.CommentInput | undefined) {
    this._input = value;
    this._onDidChangeInput.fire(value);
  }

  private readonly _onDidChangeInput = new Emitter<modes.CommentInput | undefined>();
  get onDidChangeInput(): Event<modes.CommentInput | undefined> { return this._onDidChangeInput.event; }

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

  public get comments(): modes.Comment[] | undefined {
    return this._thread.comments.map((comment) => {
      return {
        uniqueIdInThread: +comment.id,
        contextValue: comment.contextValue,
        mode: comment.mode,
        label: typeof comment.label === 'string' ? comment.label : '',
        body: {
          value: comment.body,
        },
        userName: comment.author.name,
      } as modes.Comment;
    });
  }

  public set comments(newComments: modes.Comment[] | undefined) {
    if (newComments) {
      this._thread.comments = newComments.map((comment) => {
        return {
          id: comment.uniqueIdInThread.toString(),
          mode: comment.mode,
          body: comment.body.value,
          label: comment.label,
          contextValue: comment.contextValue,
          author: {
            name: comment.userName,
            iconPath: comment.userIconPath,
          },
        } as IThreadComment;
      });
    } else {
      this._thread.comments = [];
    }

    this._onDidChangeComments.fire(newComments);
  }

  private readonly _onDidChangeComments = new Emitter<modes.Comment[] | undefined>();
  get onDidChangeComments(): Event<modes.Comment[] | undefined> { return this._onDidChangeComments.event; }

  // TODO: range 暂时不支持修改
  set range(range: IRange) {
    this._thread.range = range;
    this._onDidChangeRange.fire(this._range);
  }

  get range(): IRange {
    return this._thread.range;
  }

  private readonly _onDidChangeRange = new Emitter<IRange>();
  public onDidChangeRange = this._onDidChangeRange.event;

  private _collapsibleState: modes.CommentThreadCollapsibleState | undefined;
  get collapsibleState() {
    return this._thread.isCollapsed ? modes.CommentThreadCollapsibleState.Collapsed : modes.CommentThreadCollapsibleState.Expanded;
  }

  set collapsibleState(newState: modes.CommentThreadCollapsibleState | undefined) {
    this._thread.isCollapsed = newState === modes.CommentThreadCollapsibleState.Collapsed;
    this._onDidChangeCollasibleState.fire(this._collapsibleState);
  }

  private readonly _onDidChangeCollasibleState = new Emitter<modes.CommentThreadCollapsibleState | undefined>();
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
    private _range: IRange,
  ) {
    // 查找当前位置是否已经有评论
    // 如果则不创建
    const thread = this.commentsService.commentsThreads.find((commentThread) => commentThread.id === `${resource}#${_range.startLineNumber}`);
    // 在 data 字段保存 handle id
    const threadData = {
      commentControlHandle: controllerHandle,
      commentThreadHandle,
    };

    if (thread) {
      thread.data = threadData;
    }
    // 参照 vscode，默认显示 startLineNumber 指定行号的
    this._thread = thread || this.commentsService.createThread(new URI(resource), positionToRange(_range.startLineNumber), {
      data: threadData,
    });
    this._isDisposed = false;
  }

  batchUpdate(changes: CommentThreadChanges) {
    const modified = (value: keyof CommentThreadChanges): boolean =>
      Object.prototype.hasOwnProperty.call(changes, value);

    if (modified('range')) { this.range = changes.range!; }
    if (modified('label')) { this.label = changes.label; }
    if (modified('contextValue')) { this.contextValue = changes.contextValue; }
    if (modified('comments')) { this.comments = changes.comments; }
    if (modified('collapseState')) { this.collapsibleState = changes.collapseState; }
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
export class MainThreadCommentController implements IDisposable {

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(ICommentsService)
  private commentsService: ICommentsService;

  get handle(): number {
    return this._handle;
  }

  get uniqueId() {
    return this._uniqueId;
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

  private _reactions: modes.CommentReaction[] | undefined;

  get reactions() {
    return this._reactions;
  }

  set reactions(reactions: modes.CommentReaction[] | undefined) {
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
    private readonly _uniqueId: string,
    private readonly _id: string,
    private readonly _label: string,
    private _features: CommentProviderFeatures,
  ) {
    this.commentsService.registerCommentRangeProvider(_uniqueId, {
      getCommentingRanges: (documentModel) => this.getCommentingRanges(documentModel.uri, CancellationToken.None),
    });
  }

  // TODO: 还未实现 CommentProviderFeatures
  updateFeatures(features: CommentProviderFeatures) {
    this._features = features;
  }

  createCommentThread(
    extensionId: string,
    commentThreadHandle: number,
    threadId: string,
    resource: UriComponents,
    range: IRange,
  ): modes.CommentThread {
    const uri = URI.from(resource);
    const thread = this.injector.get(MainThreadCommentThread, [
      commentThreadHandle,
      this.handle,
      extensionId,
      threadId,
      uri.toString(),
      range,
    ]);

    this._threads.set(commentThreadHandle, thread);

    return thread;
  }

  updateCommentThread(
    commentThreadHandle: number,
    _threadId: string,
    _resource: UriComponents,
    changes: CommentThreadChanges): void {
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

  async toggleReaction(uri: URI, thread: modes.CommentThread, comment: modes.Comment, reaction: modes.CommentReaction, token: CancellationToken): Promise<void> {
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

  dispose(): void {
    this._threads.forEach((thread) => thread.dispose());
    this._threads.clear();
  }
}
