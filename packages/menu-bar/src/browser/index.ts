import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { MenuBar } from './menu-bar.view';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class MenuBarModule extends BrowserModule {
  providers: Provider[] = [];
  component = MenuBar;
}
