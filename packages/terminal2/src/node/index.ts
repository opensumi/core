import { Provider, Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { TerminalServiceImpl } from './terminal.service';
import { TerminalServiceClientImpl } from './terminal.service.client';
import { ITerminalService, ITerminalServiceClient, ITerminalServicePath } from '../common';
@Injectable()
export class Terminal2Module extends NodeModule {
  providers: Provider[] = [
    {
      token: ITerminalService,
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
