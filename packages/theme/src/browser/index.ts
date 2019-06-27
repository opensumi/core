import * as React from 'react';
import { Provider } from '@ali/common-di';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';
import { HelloWorld } from './hello-world.view';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class ThemeModule extends BrowserModule {
  providers: Provider[] = [];

  component = HelloWorld;
}
