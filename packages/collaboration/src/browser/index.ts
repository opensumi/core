import { Provider, Injectable, Domain } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import {
  ICollaborationService,
  CollaborationServiceForClientPath,
  UserInfoForCollaborationContribution,
} from '../common';

import { CollaborationContribution, MyUserInfo } from './collaboration.contribution';
import { CollaborationService } from './collaboration.service';

@Injectable()
export class CollaborationModule extends BrowserModule {
  contributionProvider: Domain | Domain[] = [UserInfoForCollaborationContribution];
  providers: Provider[] = [
    CollaborationContribution,
    MyUserInfo, // TODO debug, will be removed
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
