import { Provider, Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { TerminalService } from './terminal.service';
@Injectable()
export class Terminal2Module extends NodeModule {
  providers: Provider[] = [];
  backServices = [
    {
      servicePath: 'terminalService',
      token: TerminalService,
    },
  ];
}
