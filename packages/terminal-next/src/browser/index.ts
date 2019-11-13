import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { ITerminalController, ITerminalExternalService } from '../common';
import { TerminalBrowserContribution } from './terminal.contribution';
import { TerminalController } from './terminal.controller';
import { NodeTerminalServiceProxy } from './terminal.service';
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
      token: ITerminalExternalService,
      useClass: NodeTerminalServiceProxy,
    },
    {
      token: ITerminalTheme,
      useClass: DefaultTerminalTheme,
    },
  ];
}
