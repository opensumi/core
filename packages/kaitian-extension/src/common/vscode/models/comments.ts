import { Event, IRange } from '@ali/ide-core-common';
import { UriComponents } from './uri';
import { ICommand } from './command';
import URI from 'vscode-uri';
import { IMarkdownString } from './html-content';

/**
 * @internal
 */
export interface CommentThreadTemplate {
  controllerHandle: number;
  label: string;
  acceptInputCommand?: ICommand;
  additionalCommands?: ICommand[];
  deleteCommand?: ICommand;
}

/**
 * @internal
 */
export interface CommentInfo {
  extensionId?: string;
  threads: CommentThread[];
  commentingRanges: CommentingRanges;
}

/**
 * @internal
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
 * @internal
 */
export interface CommentWidget {
  commentThread: CommentThread;
  comment?: Comment;
  input: string;
  onDidChangeInput: Event<string>;
}

/**
 * @internal
 */
export interface CommentInput {
  value: string;
  uri: URI;
}

/**
 * @internal
 */
export interface CommentThread {
  commentThreadHandle: number;
  controllerHandle: number;
  extensionId?: string;
  threadId: string;
  resource: string | null;
  range: IRange;
  label: string | undefined;
  contextValue: string | undefined;
  comments: Comment[] | undefined;
  onDidChangeComments: Event<Comment[] | undefined>;
  collapsibleState?: CommentThreadCollapsibleState;
  input?: CommentInput;
  onDidChangeInput: Event<CommentInput | undefined>;
  onDidChangeRange: Event<IRange>;
  onDidChangeLabel: Event<string | undefined>;
  onDidChangeCollasibleState: Event<CommentThreadCollapsibleState | undefined>;
  isDisposed: boolean;
}

/**
 * @internal
 */

export interface CommentingRanges {
  readonly resource: URI;
  ranges: IRange[];
}

/**
 * @internal
 */
export interface CommentReaction {
  readonly label?: string;
  readonly iconPath?: UriComponents;
  readonly count?: number;
  readonly hasReacted?: boolean;
  readonly canEdit?: boolean;
}

/**
 * @internal
 */
export enum CommentMode {
  Editing = 0,
  Preview = 1,
}

/**
 * @internal
 */
export interface Comment {
  readonly uniqueIdInThread: number;
  readonly body: IMarkdownString;
  readonly userName: string;
  readonly userIconPath?: string;
  readonly contextValue?: string;
  readonly commentReactions?: CommentReaction[];
  readonly label?: string;
  readonly mode?: CommentMode;
}

/**
 * @internal
 */
export interface CommentThreadChangedEvent {
  /**
	 * Added comment threads.
	 */
  readonly added: CommentThread[];

  /**
	 * Removed comment threads.
	 */
  readonly removed: CommentThread[];

  /**
	 * Changed comment threads.
	 */
  readonly changed: CommentThread[];
}

export type CommentThreadChanges = Partial<{
  range: IRange,
  label: string,
  contextValue: string,
  comments: Comment[],
  collapseState: CommentThreadCollapsibleState;
}>;
