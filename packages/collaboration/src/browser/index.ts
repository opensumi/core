import { Provider, Injectable, Domain } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import {
  ICollaborationService,
  CollaborationServiceForClientPath,
  UserInfoForCollaborationContribution,
} from '../common';

import { CollaborationContribution } from './collaboration.contribution';
import { CollaborationService } from './collaboration.service';

@Injectable()
export class CollaborationModule extends BrowserModule {
  contributionProvider: Domain | Domain[] = [UserInfoForCollaborationContribution];
  providers: Provider[] = [
    CollaborationContribution,
    {
      token: ICollaborationService,
      useClass: CollaborationService,
    },
  ];

  backServices = [
    {
      servicePath: CollaborationServiceForClientPath,
    },
  ];
}
