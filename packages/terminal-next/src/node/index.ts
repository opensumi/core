import { Provider, Injectable } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';

import {
  ITerminalNodeService,
  ITerminalProcessPath,
  ITerminalProcessService,
  ITerminalServiceClient,
  ITerminalServicePath,
} from '../common';

import { PtyService, IPtyService } from './pty';
import { TerminalProcessServiceImpl } from './terminal.process.service';
import { ITerminalProfileServiceNode, TerminalProfileServiceNode } from './terminal.profile.service';
import { TerminalServiceImpl } from './terminal.service';
import { TerminalServiceClientImpl } from './terminal.service.client';

@Injectable()
export class TerminalNodePtyModule extends NodeModule {
  providers: Provider[] = [
    {
      token: ITerminalNodeService,
      useClass: TerminalServiceImpl,
    },
    {
      token: ITerminalServiceClient,
      useClass: TerminalServiceClientImpl,
    },
    {
      token: ITerminalProcessService,
      useClass: TerminalProcessServiceImpl,
    },
    {
      token: IPtyService,
      useClass: PtyService,
    },
    {
      token: ITerminalProfileServiceNode,
      useClass: TerminalProfileServiceNode,
    },
  ];

  backServices = [
    {
      servicePath: ITerminalServicePath,
      token: ITerminalServiceClient,
    },
    {
      servicePath: ITerminalProcessPath,
      token: ITerminalProcessService,
    },
  ];
}
