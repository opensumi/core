import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule, Domain} from '@ali/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { TerminalView } from './terminal.view';
import { TerminalClient } from './terminal.client';
import { ITerminalServicePath } from '../common';

@Injectable()
export class Terminal2Module extends BrowserModule {
  providers: Provider[] = [
    TerminalContribution,
  ];

  backServices = [
    {
      servicePath: ITerminalServicePath,
      clientToken: TerminalClient,
    },
  ];

}

@Domain(ComponentContribution)
export class TerminalContribution implements ComponentContribution {

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-terminal2', {
      component: TerminalView,
      id: 'ide-terminal2',
    }, {
      title: '终端',
      weight: 10,
      activateKeyBinding: 'ctrl+`',
    });
  }
}
