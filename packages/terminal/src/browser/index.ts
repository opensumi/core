import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { TerminalContribution } from './terminal-contribution';
import { Terminal } from './terminal.view';
import { BrowserModule } from '@ali/ide-core-browser';

@Injectable()
export class TerminalModule extends BrowserModule {
  providers: Provider[] = [
    TerminalContribution,
  ];
  component = Terminal;
  title = '终端';
}
