import { Injectable, Provider } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { CommentsContribution, ICommentsFeatureRegistry, ICommentsService } from '../common';

import { CommentsFeatureRegistry } from './comments-feature.registry';
import { CommentsBrowserContribution } from './comments.contribution';
import { CommentsService } from './comments.service';
import { CommentModelService } from './tree/tree-model.service';

@Injectable()
export class CommentsModule extends BrowserModule {
  contributionProvider = CommentsContribution;
  providers: Provider[] = [
    {
      token: ICommentsService,
      useClass: CommentsService,
    },
    {
      token: CommentModelService,
      useClass: CommentModelService,
    },
    {
      token: ICommentsFeatureRegistry,
      useClass: CommentsFeatureRegistry,
    },
    CommentsBrowserContribution,
  ];
}
