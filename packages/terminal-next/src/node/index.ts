import { Injectable, Provider } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';

import {
  ITerminalNodeService,
  ITerminalProcessPath,
  ITerminalProcessService,
  ITerminalServiceClient,
  ITerminalServicePath,
} from '../common';

import { IPtyService, PtyService } from './pty';
import { PtyServiceManager, PtyServiceManagerToken } from './pty.manager';
import { IShellIntegrationService, ShellIntegrationService } from './shell-integration.service';
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
      token: IShellIntegrationService,
      useClass: ShellIntegrationService,
    },
    {
      token: IPtyService,
      useClass: PtyService,
    },
    {
      token: ITerminalProfileServiceNode,
      useClass: TerminalProfileServiceNode,
    },
    {
      token: PtyServiceManagerToken,
      useClass: PtyServiceManager,
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
