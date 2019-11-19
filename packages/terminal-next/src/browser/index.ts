import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { ITerminalServicePath } from '@ali/ide-terminal2/lib/common';
import { ITerminalController, ITerminalExternalService, ITerminalRestore } from '../common';
import { TerminalBrowserContribution } from './terminal.contribution';
import { TerminalController } from './terminal.controller';
import { ITerminalTheme, DefaultTerminalTheme } from './terminal.theme';
// import { NodePtyTerminalService } from './terminal.service';
import { TerminalRestore } from './terminal.restore';

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
    /*
    {
      token: ITerminalExternalService,
      useClass: NodePtyTerminalService,
    },
    */
    {
      token: ITerminalRestore,
      useClass: TerminalRestore,
    },
  ];
  backServices = [
    {
      servicePath: ITerminalServicePath,
      clientToken: ITerminalExternalService,
    },
  ];
}
