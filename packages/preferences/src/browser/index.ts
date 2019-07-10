import * as React from 'react';
import { Provider } from '@ali/common-di';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';
import { HelloWorld } from './preferences.view';
import { PreferenceContribution } from './preference-contribution';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class PreferencesModule extends BrowserModule {
  providers: Provider[] = [
    PreferenceContribution,
  ];

  component = HelloWorld;
}
