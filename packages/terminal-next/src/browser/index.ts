import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { ITerminalServicePath } from '@ali/ide-terminal2/lib/common';
import { ITerminalController, ITerminalExternalService } from '../common';
import { TerminalBrowserContribution } from './terminal.contribution';
import { TerminalController } from './terminal.controller';
import { ITerminalTheme, DefaultTerminalTheme } from './terminal.theme';
import { NodePtyTerminalService } from './terminal.service';

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
    {
      token: ITerminalExternalService,
      useClass: NodePtyTerminalService,
    }
  ];
  backServices = [
    {
      servicePath: ITerminalServicePath,
      clientToken: ITerminalExternalService,
    },
  ];
}
