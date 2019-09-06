import { Provider, Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { TerminalServiceImpl } from './terminal.service';
import { ITerminalService, ITerminalServicePath } from '../common';
@Injectable()
export class Terminal2Module extends NodeModule {
  providers: Provider[] = [
    {
      token: ITerminalService,
      useClass: TerminalServiceImpl,
    },
  ];

  backServices = [
    {
      servicePath: ITerminalServicePath,
      token: ITerminalService,
    },
  ];
}
