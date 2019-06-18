import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { ActivatorPanel } from './activator-panel.view';

@Injectable()
export class ActivatorPanelModule extends BrowserModule {
  providers: Provider[] = [];
  component = ActivatorPanel;
}
