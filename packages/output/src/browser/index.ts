import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { OutputContribution } from './output-contribution';
import { Output } from './output.view';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class OutputModule extends BrowserModule {
  providers: Provider[] = [
    OutputContribution,
  ];
  component = Output;
  title = '输出';
}
