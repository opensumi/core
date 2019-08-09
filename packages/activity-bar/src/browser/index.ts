import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { ActivityBar } from './activity-bar.view';
import { BrowserModule } from '@ali/ide-core-browser';
import { ActivityBarContribution } from './activity-bar.contribution';

@Injectable()
export class ActivityBarModule extends BrowserModule {
  providers: Provider[] = [
    ActivityBarContribution,
  ];
  component = ActivityBar;
}
