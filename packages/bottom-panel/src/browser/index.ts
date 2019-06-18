import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BottomPanel } from './bottom-panel.view';
import { BottomPanelContribution } from './bottom-panel-contribution';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class BottomPanelModule extends BrowserModule {
  providers: Provider[] = [
    BottomPanelContribution,
  ];
  component = BottomPanel;
}
