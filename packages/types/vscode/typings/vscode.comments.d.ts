declare module 'vscode' {
  /**
   * Collapsible state of a [comment thread](#CommentThread)
   */
  export enum CommentThreadCollapsibleState {
    /**
     * Determines an item is collapsed
     */
    Collapsed = 0,

    /**
     * Determines an item is expanded
     */
    Expanded = 1,
  }

  /**
   * Comment mode of a [comment](#Comment)
   */
  export enum CommentMode {
    /**
     * Displays the comment editor
     */
    Editing = 0,

    /**
     * Displays the preview of the comment
     */
    Preview = 1,
  }

  /**
   * A collection of [comments](#Comment) representing a conversation at a particular range in a document.
   */
  export interface CommentThread {
    /**
     * The uri of the document the thread has been created on.
     */
    readonly uri: Uri;

    /**
     * The range the comment thread is located within the document. The thread icon will be shown
     * at the first line of the range.
     */
    range: Range;

    /**
     * The ordered comments of the thread.
     */
    comments: ReadonlyArray<Comment>;

    /**
     * Whether the thread should be collapsed or expanded when opening the document.
     * Defaults to Collapsed.
     */
    collapsibleState: CommentThreadCollapsibleState;

    /**
     * Whether the thread supports reply.
     * Defaults to true.
     */
    canReply: boolean;

    /**
     * Context value of the comment thread. This can be used to contribute thread specific actions.
     * For example, a comment thread is given a context value as `editable`. When contributing actions to `comments/commentThread/title`
     * using `menus` extension point, you can specify context value for key `commentThread` in `when` expression like `commentThread == editable`.
     * ```
     *  "contributes": {
     *    "menus": {
     *      "comments/commentThread/title": [
     *        {
     *          "command": "extension.deleteCommentThread",
     *          "when": "commentThread == editable"
     *        }
     *      ]
     *    }
     *  }
     * ```
     * This will show action `extension.deleteCommentThread` only for comment threads with `contextValue` is `editable`.
     */
    contextValue?: string;

    /**
     * The optional human-readable label describing the [Comment Thread](#CommentThread)
     */
    label?: string;

    /**
     * Dispose this comment thread.
     *
     * Once disposed, this comment thread will be removed from visible editors and Comment Panel when approriate.
     */
    dispose(): void;
  }

  /**
   * Author information of a [comment](#Comment)
   */
  export interface CommentAuthorInformation {
    /**
     * The display name of the author of the comment
     */
    name: string;

    /**
     * The optional icon path for the author
     */
    iconPath?: Uri;
  }

  /**
   * Reactions of a [comment](#Comment)
   */
  export interface CommentReaction {
    /**
     * The human-readable label for the reaction
     */
    readonly label: string;

    /**
     * Icon for the reaction shown in UI.
     */
    readonly iconPath: string | Uri;

    /**
     * The number of users who have reacted to this reaction
     */
    readonly count: number;

    /**
     * Whether the [author](CommentAuthorInformation) of the comment has reacted to this reaction
     */
    readonly authorHasReacted: boolean;
  }

  /**
   * Represents a {@link CommentController comment controller}'s {@link CommentController.options options}.
   */
  export interface CommentOptions {
    /**
     * TODO: kaitian 评论组件交互无收起时保留输入框的设计，该值设置无效
     * An optional string to show on the comment input box when it's collapsed.
     */
    prompt?: string;

    /**
     * An optional string to show as placeholder in the comment input box when it's focused.
     */
    placeHolder?: string;
  }

  /**
   * A comment is displayed within the editor or the Comments Panel, depending on how it is provided.
   */
  export interface Comment {
    /**
     * The human-readable comment body
     */
    body: string | MarkdownString;

    /**
     * [Comment mode](#CommentMode) of the comment
     */
    mode: CommentMode;

    /**
     * The [author information](#CommentAuthorInformation) of the comment
     */
    author: CommentAuthorInformation;

    /**
     * Context value of the comment. This can be used to contribute comment specific actions.
     * For example, a comment is given a context value as `editable`. When contributing actions to `comments/comment/title`
     * using `menus` extension point, you can specify context value for key `comment` in `when` expression like `comment == editable`.
     * ```json
     *  "contributes": {
     *    "menus": {
     *      "comments/comment/title": [
     *        {
     *          "command": "extension.deleteComment",
     *          "when": "comment == editable"
     *        }
     *      ]
     *    }
     *  }
     * ```
     * This will show action `extension.deleteComment` only for comments with `contextValue` is `editable`.
     */
    contextValue?: string;

    /**
     * Optional reactions of the [comment](#Comment)
     */
    reactions?: CommentReaction[];

    /**
     * Optional label describing the [Comment](#Comment)
     * Label will be rendered next to authorName if exists.
     */
    label?: string;

    /**
     * Optional timestamp that will be displayed in comments.
     * The date will be formatted according to the user's locale and settings.
     */
    timestamp?: Date;
  }

  /**
   * Command argument for actions registered in `comments/commentThread/context`.
   */
  export interface CommentReply {
    /**
     * The active [comment thread](#CommentThread)
     */
    thread: CommentThread;

    /**
     * The value in the comment editor
     */
    text: string;
  }

  /**
   * Commenting range provider for a [comment controller](#CommentController).
   */
  export interface CommentingRangeProvider {
    /**
     * Provide a list of ranges which allow new comment threads creation or null for a given document
     */
    provideCommentingRanges(document: TextDocument, token: CancellationToken): ProviderResult<Range[]>;
  }

  /**
   * A comment controller is able to provide [comments](#CommentThread) support to the editor and
   * provide users various ways to interact with comments.
   */
  export interface CommentController {
    /**
     * The id of this comment controller.
     */
    readonly id: string;

    /**
     * The human-readable label of this comment controller.
     */
    readonly label: string;

    /**
     * Optional commenting range provider. Provide a list [ranges](#Range) which support commenting to any given resource uri.
     *
     * If not provided, users can leave comments in any document opened in the editor.
     */
    commentingRangeProvider?: CommentingRangeProvider;

    /**
     * Create a [comment thread](#CommentThread). The comment thread will be displayed in visible text editors (if the resource matches)
     * and Comments Panel once created.
     *
     * @param uri The uri of the document the thread has been created on.
     * @param range The range the comment thread is located within the document.
     * @param comments The ordered comments of the thread.
     */
    createCommentThread(uri: Uri, range: Range, comments: Comment[]): CommentThread;

    /**
     * Comment controller options
     */
    options?: CommentOptions;

    /**
     * Optional reaction handler for creating and deleting reactions on a [comment](#Comment).
     */
    reactionHandler?: (comment: Comment, reaction: CommentReaction) => Promise<void>;

    /**
     * Dispose this comment controller.
     *
     * Once disposed, all [comment threads](#CommentThread) created by this comment controller will also be removed from the editor
     * and Comments Panel.
     */
    dispose(): void;
  }

  namespace comments {
    /**
     * Creates a new [comment controller](#CommentController) instance.
     *
     * @param id An `id` for the comment controller.
     * @param label A human-readable string for the comment controller.
     * @return An instance of [comment controller](#CommentController).
     */
    export function createCommentController(id: string, label: string): CommentController;
  }
}
