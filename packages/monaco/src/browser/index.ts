import * as React from 'react';
import MonacoServiceImpl from './monaco.service';
import { createMonacoServiceProvider } from '../common';
import { Injectable, Provider } from '@ali/common-di';
export { default as MonacoService } from './monaco.service';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class MonacoModule extends BrowserModule {
  providers: Provider[] = [
    createMonacoServiceProvider(MonacoServiceImpl),
  ];
}
