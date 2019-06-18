import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { BottomPanel } from './bottom-panel.view';

import { BottomPanelContribution } from './bottom-panel-contribution';
import { isFlowBaseAnnotation } from '@babel/types';

@Injectable()
export class BottomPanelModule extends BrowserModule {
  providers: Provider[] = [
    BottomPanelContribution,
  ];
  component = BottomPanel;
}
