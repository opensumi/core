import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { TerminalContribution } from './terminal-contribution';
import { BrowserModule } from '@ali/ide-core-browser';

@Injectable()
export class TerminalModule extends BrowserModule {
  providers: Provider[] = [
    TerminalContribution,
  ];
}
