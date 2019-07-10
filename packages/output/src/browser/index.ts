import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { OutputContribution } from './output-contribution';
import { Output } from './output.view';
import { BrowserModule } from '@ali/ide-core-browser';

@Injectable()
export class OutputModule extends BrowserModule {
  providers: Provider[] = [
    OutputContribution,
  ];
}
