import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';

import { StatusBarView } from './status-bar.view';
import { StatusBarService, StatusBar } from './status-bar.service';

@Injectable()
export class StatusBarModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: StatusBar,
      useClass: StatusBarService,
    },
  ];
  component = StatusBarView;
}
