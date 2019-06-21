import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { ActivatorPanel } from './activator-panel.view';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';
const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class ActivatorPanelModule extends BrowserModule {
  providers: Provider[] = [];
  component = ActivatorPanel;
}
