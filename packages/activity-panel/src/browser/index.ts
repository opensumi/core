import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { ActivityPanel } from './activity-panel.view';
import { BrowserModule } from '@ali/ide-core-browser';
import { ActivityPanelContribution } from './activity-panel.contribution';

@Injectable()
export class ActivityPanelModule extends BrowserModule {
  providers: Provider[] = [
    ActivityPanelContribution,
  ];
  component = ActivityPanel;
}

export * from './view-container-widget.view';
export * from './react-panel-widget.view';
export * from './bottom-panel-widget.view';
