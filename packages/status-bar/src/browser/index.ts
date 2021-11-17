import { Provider, Injectable } from '@ide-framework/common-di';
import { StatusBarView } from './status-bar.view';
import { StatusBarService } from './status-bar.service';
import { BrowserModule } from '@ide-framework/ide-core-browser';
import { StatusBarContribution } from './status-bar.contribution';
// import { IStatusBarService } from '../common';
import { IStatusBarService } from '@ide-framework/ide-core-browser/lib/services';

@Injectable()
export class StatusBarModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: IStatusBarService,
      useClass: StatusBarService,
    },
    StatusBarContribution,
  ];
  component = StatusBarView;
}
