import { Injectable, Provider } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { IDirtyDiffWorkbenchController, ISCMMenus, SCMService } from '../common';

import { DirtyDiffWorkbenchController } from './dirty-diff';
import { SCMBadgeController, SCMStatusBarController } from './scm-activity';
import { SCMMenus } from './scm-menu';
import { bindSCMPreference } from './scm-preference';
import { SCMContribution } from './scm.contribution';

@Injectable()
export class SCMModule extends BrowserModule {
  providers: Provider[] = [
    SCMContribution,
    SCMService,
    SCMBadgeController,
    SCMStatusBarController,
    {
      token: ISCMMenus,
      useClass: SCMMenus,
    },
    {
      token: IDirtyDiffWorkbenchController,
      useClass: DirtyDiffWorkbenchController,
    },
  ];

  preferences = bindSCMPreference;
}
