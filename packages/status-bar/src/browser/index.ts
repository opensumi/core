import { Injectable, Provider } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { IStatusBarService } from '@opensumi/ide-core-browser/lib/services';

import { StatusBarContribution } from './status-bar.contribution';
// import { IStatusBarService } from '../common';
import { StatusBarService } from './status-bar.service';

@Injectable()
export class StatusBarModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: IStatusBarService,
      useClass: StatusBarService,
    },
    StatusBarContribution,
  ];
}
