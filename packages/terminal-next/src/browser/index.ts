import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { ITerminalController } from '../common';
import { TerminalBrowserContribution } from './terminal.contribution';
import { TerminalController } from './terminal.controller';
import { ITerminalTheme, DefaultTerminalTheme } from './terminal.theme';

@Injectable()
export class TerminalNextModule extends BrowserModule {
  providers: Provider[] = [
    TerminalBrowserContribution,
    {
      token: ITerminalController,
      useClass: TerminalController,
    },
    {
      token: ITerminalTheme,
      useClass: DefaultTerminalTheme,
    },
  ];
}
