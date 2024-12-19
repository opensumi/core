/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Some code copied and modified from https://github.com/microsoft/vscode/blob/main/src/vs/editor/common/languages.ts

import { IMarkdownString, IRange } from '@opensumi/ide-core-common';

import type { UriComponents } from '@opensumi/monaco-editor-core/esm/vs/base/common/uri';
import type {
  Comment,
  CommentInput,
  CommentOptions,
  CommentReaction,
  CommentThread,
  CommentThreadChangedEvent,
  CommentingRanges,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';

/**
 * @internal
 */
enum CommentThreadCollapsibleState {
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
enum CommentThreadState {
  Unresolved = 0,
  Resolved = 1,
}

enum CommentThreadApplicability {
  Current = 0,
  Outdated = 1,
}

/**
 * @internal
 */
enum CommentMode {
  Editing = 0,
  Preview = 1,
}

/**
 * @internal
 */
enum CommentState {
  Published = 0,
  Draft = 1,
}

export interface CommentChanges {
  readonly uniqueIdInThread: number;
  readonly body: string | IMarkdownString;
  readonly userName: string;
  readonly userIconPath?: UriComponents;
  readonly contextValue?: string;
  readonly commentReactions?: CommentReaction[];
  readonly label?: string;
  readonly mode?: CommentMode;
  readonly state?: CommentState;
  readonly timestamp?: string;
}

export type CommentThreadChanges<T = IRange> = Partial<{
  range: T | undefined;
  label: string;
  contextValue: string | undefined;
  comments: CommentChanges[];
  collapseState: CommentThreadCollapsibleState;
  canReply: boolean;
  state: CommentThreadState;
  applicability: CommentThreadApplicability;
  isTemplate: boolean;
}>;

export {
  Comment,
  CommentInput,
  CommentMode,
  CommentOptions,
  CommentReaction,
  CommentThread,
  CommentThreadChangedEvent,
  CommentThreadCollapsibleState,
  CommentingRanges,
};
