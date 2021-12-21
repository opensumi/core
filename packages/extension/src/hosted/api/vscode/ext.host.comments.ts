/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// some code copied and modified from https://github.com/microsoft/vscode/blob/main/src/vs/workbench/api/common/extHostComments.ts#L32

import type vscode from 'vscode';
import {
  Uri as URI,
  MutableDisposable,
  DisposableStore,
  IRange,
  Emitter,
  debounce,
  asPromise,
  CancellationToken,
} from '@opensumi/ide-core-common';
import { IExtHostComments, IMainThreadComments } from '../../../common/vscode/comments';
import { IRPCProtocol } from '@opensumi/ide-connection';
import {
  MainThreadAPIIdentifier,
  IExtHostCommands,
  ExtensionDocumentDataManager,
  IExtensionDescription,
} from '../../../common/vscode';
import type { UriComponents } from '@opensumi/ide-core-common';
import * as extHostTypeConverter from '../../../common/vscode/converter';
import * as models from '../../../common/vscode/models';
import * as types from '../../../common/vscode/ext-types';
import { getExtensionId } from '../../../common';

type ProviderHandle = number;
type ReactionHandler = (comment: vscode.Comment, reaction: vscode.CommentReaction) => Promise<void>;
type CommentThreadModification = Partial<{
  range: vscode.Range;
  label: string | undefined;
  contextValue: string | undefined;
  comments: vscode.Comment[];
  collapsibleState: vscode.CommentThreadCollapsibleState;
  canReply: boolean;
}>;

export function createCommentsApiFactory(extension: IExtensionDescription, extHostComments: ExtHostComments) {
  const comment: typeof vscode.comments = {
    createCommentController(id: string, label: string) {
      return extHostComments.createCommentController(extension, id, label);
    },
  };
  return comment;
}

export class ExtHostComments implements IExtHostComments {
  private static handlePool = 0;

  private readonly _proxy: IMainThreadComments;

  private _commentControllers: Map<ProviderHandle, ExtHostCommentController> = new Map<
    ProviderHandle,
    ExtHostCommentController
  >();

  private _commentControllersByExtension: Map<string, ExtHostCommentController[]> = new Map<
    string,
    ExtHostCommentController[]
  >();

  constructor(
    private readonly rpcProtocol: IRPCProtocol,
    commands: IExtHostCommands,
    private readonly _documents: ExtensionDocumentDataManager,
  ) {
    this._proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadComments);
    this.registerArgumentProcessor(commands);
  }

  private registerArgumentProcessor(commands: IExtHostCommands) {
    commands.registerArgumentProcessor({
      processArgument: (arg) => {
        if (arg && arg.$mid === 6) {
          const commentController = this._commentControllers.get(arg.handle);

          if (!commentController) {
            return arg;
          }

          return commentController;
        } else if (arg && arg.$mid === 7) {
          const commentController = this._commentControllers.get(arg.commentControlHandle);

          if (!commentController) {
            return arg;
          }

          const commentThread = commentController.getCommentThread(arg.commentThreadHandle);

          if (!commentThread) {
            return arg;
          }

          return commentThread;
        } else if (arg && arg.$mid === 8) {
          const commentController = this._commentControllers.get(arg.thread.commentControlHandle);

          if (!commentController) {
            return arg;
          }

          const commentThread = commentController.getCommentThread(arg.thread.commentThreadHandle);

          if (!commentThread) {
            return arg;
          }

          return {
            thread: commentThread,
            text: arg.text,
          };
        } else if (arg && arg.$mid === 9) {
          const commentController = this._commentControllers.get(arg.thread.commentControlHandle);

          if (!commentController) {
            return arg;
          }

          const commentThread = commentController.getCommentThread(arg.thread.commentThreadHandle);

          if (!commentThread) {
            return arg;
          }

          const commentUniqueId = arg.commentUniqueId;
          const comment = commentThread.getCommentByUniqueId(commentUniqueId);

          if (!comment) {
            return arg;
          }

          return comment;
        } else if (arg && arg.$mid === 10) {
          const commentController = this._commentControllers.get(arg.thread.commentControlHandle);

          if (!commentController) {
            return arg;
          }

          const commentThread = commentController.getCommentThread(arg.thread.commentThreadHandle);

          if (!commentThread) {
            return arg;
          }

          const body = arg.text;
          const commentUniqueId = arg.commentUniqueId;

          const comment = commentThread.getCommentByUniqueId(commentUniqueId);

          if (!comment) {
            return arg;
          }

          comment.body = body;
          return comment;
        }

        return arg;
      },
    });
  }

  createCommentController(extension: IExtensionDescription, id: string, label: string): vscode.CommentController {
    const handle = ExtHostComments.handlePool++;
    const commentController = new ExtHostCommentController(extension, handle, this._proxy, id, label);
    this._commentControllers.set(commentController.handle, commentController);

    const commentControllers = this._commentControllersByExtension.get(getExtensionId(extension.id)) || [];
    commentControllers.push(commentController);
    this._commentControllersByExtension.set(getExtensionId(extension.id), commentControllers);

    return commentController;
  }

  $createCommentThreadTemplate(commentControllerHandle: number, uriComponents: UriComponents, range: IRange): void {
    const commentController = this._commentControllers.get(commentControllerHandle);

    if (!commentController) {
      return;
    }

    commentController.$createCommentThreadTemplate(uriComponents, range);
  }

  async $updateCommentThreadTemplate(commentControllerHandle: number, threadHandle: number, range: IRange) {
    const commentController = this._commentControllers.get(commentControllerHandle);

    if (!commentController) {
      return;
    }

    commentController.$updateCommentThreadTemplate(threadHandle, range);
  }

  $deleteCommentThread(commentControllerHandle: number, commentThreadHandle: number) {
    const commentController = this._commentControllers.get(commentControllerHandle);

    if (commentController) {
      commentController.$deleteCommentThread(commentThreadHandle);
    }
  }

  $provideCommentingRanges(
    commentControllerHandle: number,
    uriComponents: UriComponents,
    token: CancellationToken,
  ): Promise<IRange[] | undefined> {
    const commentController = this._commentControllers.get(commentControllerHandle);

    if (!commentController || !commentController.commentingRangeProvider) {
      return Promise.resolve(undefined);
    }

    const document = this._documents.getDocument(URI.revive(uriComponents));
    if(!document) {
      return Promise.resolve(undefined);
    }

    return asPromise(() => commentController.commentingRangeProvider?.provideCommentingRanges(document, token)).then(
      (ranges) => (ranges ? ranges.map((x) => extHostTypeConverter.fromRange(x)) : undefined),
    );
  }

  $toggleReaction(
    commentControllerHandle: number,
    threadHandle: number,
    uri: UriComponents,
    comment: models.Comment,
    reaction: models.CommentReaction,
  ): Promise<void> {
    const commentController = this._commentControllers.get(commentControllerHandle);

    if (!commentController || !commentController.reactionHandler) {
      return Promise.resolve(undefined);
    }

    return asPromise(() => {
      const commentThread = commentController.getCommentThread(threadHandle);
      if (commentThread) {
        const vscodeComment = commentThread.getCommentByUniqueId(comment.uniqueIdInThread);

        if (commentController !== undefined && vscodeComment) {
          if (commentController.reactionHandler) {
            return commentController.reactionHandler(vscodeComment, convertFromReaction(reaction));
          }
        }
      }

      return Promise.resolve(undefined);
    });
  }
}

class ExtHostCommentController implements vscode.CommentController {
  get id(): string {
    return this._id;
  }

  get label(): string {
    return this._label;
  }

  public get handle(): number {
    return this._handle;
  }

  private _threads: Map<number, ExtHostCommentThread> = new Map<number, ExtHostCommentThread>();
  commentingRangeProvider?: vscode.CommentingRangeProvider;

  private _reactionHandler?: ReactionHandler;

  private _options: vscode.CommentOptions | undefined;

  get options() {
    return this._options;
  }

  set options(options: vscode.CommentOptions | undefined) {
    this._options = options;

    this._proxy.$updateCommentControllerFeatures(this.handle, { options: this._options });
  }

  get reactionHandler(): ReactionHandler | undefined {
    return this._reactionHandler;
  }

  set reactionHandler(handler: ReactionHandler | undefined) {
    this._reactionHandler = handler;

    this._proxy.$updateCommentControllerFeatures(this.handle, { reactionHandler: !!handler });
  }

  constructor(
    private _extension: IExtensionDescription,
    private _handle: number,
    private _proxy: IMainThreadComments,
    private _id: string,
    private _label: string,
  ) {
    this._proxy.$registerCommentController(this.handle, _id, _label);
  }

  createCommentThread(resource: vscode.Uri, range: vscode.Range, comments: vscode.Comment[]): vscode.CommentThread;
  createCommentThread(
    arg0: vscode.Uri | string,
    arg1: vscode.Uri | vscode.Range,
    arg2: vscode.Range | vscode.Comment[],
    arg3?: vscode.Comment[],
  ): vscode.CommentThread {
    if (typeof arg0 === 'string') {
      const commentThread = new ExtHostCommentThread(
        this._proxy,
        this,
        arg0,
        arg1 as vscode.Uri,
        arg2 as vscode.Range,
        arg3 as vscode.Comment[],
        this._extension,
      );
      this._threads.set(commentThread.handle, commentThread);
      return commentThread;
    } else {
      const commentThread = new ExtHostCommentThread(
        this._proxy,
        this,
        undefined,
        arg0 as vscode.Uri,
        arg1 as vscode.Range,
        arg2 as vscode.Comment[],
        this._extension,
      );
      this._threads.set(commentThread.handle, commentThread);
      return commentThread;
    }
  }

  $createCommentThreadTemplate(uriComponents: UriComponents, range: IRange): ExtHostCommentThread {
    const commentThread = new ExtHostCommentThread(
      this._proxy,
      this,
      undefined,
      URI.revive(uriComponents),
      extHostTypeConverter.toRange(range),
      [],
      this._extension,
    );
    commentThread.collapsibleState = models.CommentThreadCollapsibleState.Expanded;
    this._threads.set(commentThread.handle, commentThread);
    return commentThread;
  }

  $updateCommentThreadTemplate(threadHandle: number, range: IRange): void {
    const thread = this._threads.get(threadHandle);
    if (thread) {
      thread.range = extHostTypeConverter.toRange(range);
    }
  }

  $deleteCommentThread(threadHandle: number): void {
    const thread = this._threads.get(threadHandle);

    if (thread) {
      thread.dispose();
    }

    this._threads.delete(threadHandle);
  }

  getCommentThread(handle: number): ExtHostCommentThread | undefined {
    return this._threads.get(handle);
  }

  dispose(): void {
    this._threads.forEach((value) => {
      value.dispose();
    });

    this._proxy.$unregisterCommentController(this.handle);
  }
}

export class ExtHostCommentThread implements vscode.CommentThread {
  private static _handlePool = 0;
  readonly handle = ExtHostCommentThread._handlePool++;
  public commentHandle = 0;

  private modifications: CommentThreadModification = Object.create(null);

  set threadId(id: string) {
    this._id = id;
  }

  get threadId(): string {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this._id!;
  }

  get id(): string {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this._id!;
  }

  get resource(): vscode.Uri {
    return this._uri;
  }

  get uri(): vscode.Uri {
    return this._uri;
  }

  private readonly _onDidUpdateCommentThread = new Emitter<void>();
  readonly onDidUpdateCommentThread = this._onDidUpdateCommentThread.event;

  set range(range: vscode.Range) {
    if (!range.isEqual(this._range)) {
      this._range = range;
      this.modifications.range = range;
      this._onDidUpdateCommentThread.fire();
    }
  }

  get range(): vscode.Range {
    return this._range;
  }

  private _canReply = true;

  set canReply(state: boolean) {
    if (this._canReply !== state) {
      this._canReply = state;
      this.modifications.canReply = state;
      this._onDidUpdateCommentThread.fire();
    }
  }

  get canReply() {
    return this._canReply;
  }

  private _label: string | undefined;

  get label(): string | undefined {
    return this._label;
  }

  set label(label: string | undefined) {
    this._label = label;
    this.modifications.label = label;
    this._onDidUpdateCommentThread.fire();
  }

  private _contextValue: string | undefined;

  get contextValue(): string | undefined {
    return this._contextValue;
  }

  set contextValue(context: string | undefined) {
    this._contextValue = context;
    this.modifications.contextValue = context;
    this._onDidUpdateCommentThread.fire();
  }

  get comments(): vscode.Comment[] {
    return this._comments;
  }

  set comments(newComments: vscode.Comment[]) {
    this._comments = newComments;
    this.modifications.comments = newComments;
    this._onDidUpdateCommentThread.fire();
  }

  private _collapseState?: vscode.CommentThreadCollapsibleState;

  get collapsibleState(): vscode.CommentThreadCollapsibleState {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this._collapseState!;
  }

  set collapsibleState(newState: vscode.CommentThreadCollapsibleState) {
    this._collapseState = newState;
    this.modifications.collapsibleState = newState;
    this._onDidUpdateCommentThread.fire();
  }

  private _localDisposables: types.Disposable[];

  private _isDiposed: boolean;

  public get isDisposed(): boolean {
    return this._isDiposed;
  }

  private _commentsMap: Map<vscode.Comment, number> = new Map<vscode.Comment, number>();

  private _acceptInputDisposables = new MutableDisposable<DisposableStore>();

  constructor(
    private _proxy: IMainThreadComments,
    private _commentController: ExtHostCommentController,
    private _id: string | undefined,
    private _uri: vscode.Uri,
    private _range: vscode.Range,
    private _comments: vscode.Comment[],
    extension: IExtensionDescription,
  ) {
    this._acceptInputDisposables.value = new DisposableStore();

    if (this._id === undefined) {
      this._id = `${_commentController.id}.${this.handle}`;
    }

    this._proxy.$createCommentThread(
      this._commentController.handle,
      this.handle,
      this._id,
      this._uri,
      extHostTypeConverter.fromRange(this._range),
      extension.id,
    );

    this._localDisposables = [];
    this._isDiposed = false;

    this._localDisposables.push(
      types.Disposable.from(
        this.onDidUpdateCommentThread(() => {
          this.eventuallyUpdateCommentThread();
        }),
      ),
    );

    // set up comments after ctor to batch update events.
    this.comments = _comments;
  }

  @debounce(100)
  eventuallyUpdateCommentThread(): void {
    if (this._isDiposed) {
      return;
    }

    if (!this._acceptInputDisposables.value) {
      this._acceptInputDisposables.value = new DisposableStore();
    }

    const modified = (value: keyof CommentThreadModification): boolean =>
      Object.prototype.hasOwnProperty.call(this.modifications, value);

    const formattedModifications: models.CommentThreadChanges = {};
    if (modified('range')) {
      formattedModifications.range = extHostTypeConverter.fromRange(this._range);
    }
    if (modified('label')) {
      formattedModifications.label = this.label;
    }
    if (modified('contextValue')) {
      formattedModifications.contextValue = this.contextValue;
    }
    if (modified('comments')) {
      formattedModifications.comments = this._comments.map((cmt) =>
        convertToModeComment(this, this._commentController, cmt, this._commentsMap),
      );
    }
    if (modified('collapsibleState')) {
      formattedModifications.collapseState = convertToCollapsibleState(this._collapseState);
    }
    if (modified('canReply')) {
      formattedModifications.canReply = this.canReply;
    }
    this.modifications = {};

    this._proxy.$updateCommentThread(
      this._commentController.handle,
      this.handle,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this._id!,
      this._uri,
      formattedModifications,
    );
  }

  getCommentByUniqueId(uniqueId: number): vscode.Comment | undefined {
    for (const key of this._commentsMap) {
      const comment = key[0];
      const id = key[1];
      if (uniqueId === id) {
        return comment;
      }
    }

    return;
  }

  dispose() {
    this._isDiposed = true;
    this._acceptInputDisposables.dispose();
    this._localDisposables.forEach((disposable) => disposable.dispose());
    this._proxy.$deleteCommentThread(this._commentController.handle, this.handle);
  }
}

function convertToModeComment(
  thread: ExtHostCommentThread,
  commentController: ExtHostCommentController,
  vscodeComment: vscode.Comment,
  commentsMap: Map<vscode.Comment, number>,
): models.Comment {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  let commentUniqueId = commentsMap.get(vscodeComment)!;
  if (!commentUniqueId) {
    commentUniqueId = ++thread.commentHandle;
    commentsMap.set(vscodeComment, commentUniqueId);
  }

  const iconPath =
    vscodeComment.author && vscodeComment.author.iconPath ? vscodeComment.author.iconPath.toString() : undefined;

  return {
    mode: vscodeComment.mode,
    contextValue: vscodeComment.contextValue,
    uniqueIdInThread: commentUniqueId,
    body: extHostTypeConverter.fromManyMarkdown([vscodeComment.body])[0],
    userName: vscodeComment.author.name,
    userIconPath: iconPath,
    label: vscodeComment.label,
    commentReactions: vscodeComment.reactions
      ? vscodeComment.reactions.map((reaction) => convertToReaction(reaction))
      : undefined,
  };
}

function convertToReaction(reaction: vscode.CommentReaction): models.CommentReaction {
  return {
    label: reaction.label,
    iconPath: reaction.iconPath ? extHostTypeConverter.pathOrURIToURI(reaction.iconPath) : undefined,
    count: reaction.count,
    hasReacted: reaction.authorHasReacted,
  };
}

function convertFromReaction(reaction: models.CommentReaction): vscode.CommentReaction {
  return {
    label: reaction.label || '',
    count: reaction.count || 0,
    iconPath: reaction.iconPath ? URI.revive(reaction.iconPath) : '',
    authorHasReacted: reaction.hasReacted || false,
  };
}

function convertToCollapsibleState(
  kind: vscode.CommentThreadCollapsibleState | undefined,
): models.CommentThreadCollapsibleState {
  if (kind !== undefined) {
    switch (kind) {
      case types.CommentThreadCollapsibleState.Expanded:
        return models.CommentThreadCollapsibleState.Expanded;
      case types.CommentThreadCollapsibleState.Collapsed:
        return models.CommentThreadCollapsibleState.Collapsed;
    }
  }
  return models.CommentThreadCollapsibleState.Collapsed;
}
