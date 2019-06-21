import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { MenuBar } from './menu-bar.view';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';
import { MenuBarContribution } from './menu-bar.contribution';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class MenuBarModule extends BrowserModule {
  providers: Provider[] = [
    MenuBarContribution,
  ];
  component = MenuBar;
}
