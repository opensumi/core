import { Provider, Injectable } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';
import { TerminalServiceImpl } from './terminal.service';
import { TerminalServiceClientImpl } from './terminal.service.client';
import { ITerminalNodeService, ITerminalServiceClient, ITerminalServicePath } from '../common';

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
  ];

  backServices = [
    {
      servicePath: ITerminalServicePath,
      token: ITerminalServiceClient,
    },
  ];
}
