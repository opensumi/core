import { IRange, CancellationToken } from '@opensumi/ide-core-common';

import * as modes from './models';
import { UriComponents, CommentThreadChanges } from './models';

export interface CommentProviderFeatures {
  reactionGroup?: modes.CommentReaction[];
  reactionHandler?: boolean;
  options?: modes.CommentOptions;
}

export interface IMainThreadComments {
  $registerCommentController(handle: number, id: string, label: string): void;
  $updateCommentControllerFeatures(handle: number, features: CommentProviderFeatures): void;
  $unregisterCommentController(handle: number): void;
  $createCommentThread(
    handle: number,
    commentThreadHandle: number,
    threadId: string,
    resource: UriComponents,
    range: IRange,
    extensionId: string,
  ): modes.CommentThread | undefined;
  $updateCommentThread(
    handle: number,
    commentThreadHandle: number,
    threadId: string,
    resource: UriComponents,
    changes: CommentThreadChanges,
  ): void;
  $deleteCommentThread(handle: number, commentThreadHandle: number): void;
}

export interface IExtHostComments {
  $createCommentThreadTemplate(commentControllerHandle: number, uriComponents: UriComponents, range: IRange): void;
  $updateCommentThreadTemplate(commentControllerHandle: number, threadHandle: number, range: IRange): Promise<void>;
  $deleteCommentThread(commentControllerHandle: number, commentThreadHandle: number): void;
  $provideCommentingRanges(
    commentControllerHandle: number,
    uriComponents: UriComponents,
    token: CancellationToken,
  ): Promise<IRange[] | undefined>;
  $toggleReaction(
    commentControllerHandle: number,
    threadHandle: number,
    uri: UriComponents,
    comment: modes.Comment,
    reaction: modes.CommentReaction,
  ): Promise<void>;
}
