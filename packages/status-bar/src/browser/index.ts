import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { StatusBarView } from './status-bar.view';
import { StatusBarService } from './status-bar.service';
import { BrowserModule } from '@ali/ide-core-browser';
import { StatusBarContribution } from './status-bar.contribution';
import { IStatusBarService } from '../common';

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
