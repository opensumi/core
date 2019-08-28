import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';

import { SCMService } from '../common';
import { SCMContribution } from './scm-contribution';
import { StatusUpdater, StatusBarController } from './scm-activity';

@Injectable()
export class SCMModule extends BrowserModule {
  providers: Provider[] = [
    SCMContribution,
    SCMService,
    StatusUpdater,
    StatusBarController,
  ];
}
