import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { TerminalClient } from './terminal.client';
import { ITerminalServicePath, ITerminalClient, IExternlTerminalService } from '../common';
import { MockTerminalService } from './terminal.override';

import { registerTerminalColors } from './terminal-color';
import { TerminalKeybindingContext } from './terminal-keybinding-contexts';
import { TerminalContribution } from './terminal.contribution';

registerTerminalColors();

@Injectable()
export class Terminal2Module extends BrowserModule {
  providers: Provider[] = [
    TerminalContribution,
    TerminalKeybindingContext,
    {
      token: ITerminalClient,
      useClass: TerminalClient,
    },
    {
      token: IExternlTerminalService,
      useClass: MockTerminalService,
    },
  ];

  backServices = [
    {
      servicePath: ITerminalServicePath,
      clientToken: IExternlTerminalService,
    },
  ];

}
