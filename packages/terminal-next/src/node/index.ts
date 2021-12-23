import { Provider, Injectable } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';
import { TerminalServiceImpl } from './terminal.service';
import { TerminalServiceClientImpl } from './terminal.service.client';
import {
  ITerminalNodeService,
  ITerminalProcessPath,
  ITerminalProcessService,
  ITerminalServiceClient,
  ITerminalServicePath,
} from '../common';
import { TerminalProcessServiceImpl } from './terminal-process.service';
import { PtyService, IPtyService } from './pty';

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
