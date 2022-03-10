import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { CommentsContribution, ICommentsService, ICommentsFeatureRegistry } from '../common';

import { CommentsFeatureRegistry } from './comments-feature.registry';
import { CommentsBrowserContribution } from './comments.contribution';
import { CommentsService } from './comments.service';

import './comments.module.less';

@Injectable()
export class CommentsModule extends BrowserModule {
  contributionProvider = CommentsContribution;
  providers: Provider[] = [
    {
      token: ICommentsService,
      useClass: CommentsService,
    },
    {
      token: ICommentsFeatureRegistry,
      useClass: CommentsFeatureRegistry,
    },
    CommentsBrowserContribution,
  ];
}
