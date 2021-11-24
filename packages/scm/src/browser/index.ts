import { Provider, Injectable } from '@opensumi/common-di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { ISCMMenus, SCMService, IDirtyDiffWorkbenchController } from '../common';

import { SCMContribution } from './scm.contribution';
import { SCMBadgeController, SCMStatusBarController } from './scm-activity';
import { bindSCMPreference } from './scm-preference';
import { DirtyDiffWorkbenchController } from './dirty-diff';
import { SCMMenus } from './scm-menu';

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
