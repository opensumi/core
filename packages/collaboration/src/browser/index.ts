import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { ICollaborationService } from '../common';

import { CollaborationContribution } from './collaboration.contribution';
import { CollaborationService } from './collaboration.service';

@Injectable()
export class CollaborationModule extends BrowserModule {
  providers: Provider[] = [
    CollaborationContribution,
    {
      token: ICollaborationService,
      useClass: CollaborationService,
    },
  ];
}
