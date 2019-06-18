import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { TerminalContribution } from './terminal-contribution';
import { Terminal } from './terminal.view';

@Injectable()
export class TerminalModule extends BrowserModule {
  providers: Provider[] = [
    TerminalContribution,
  ];
  component = Terminal;
  title = '终端';
}
