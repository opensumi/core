import * as React from 'react';
import { Provider, Injectable, Autowired } from '@ali/common-di';
import { BrowserModule , ClientAppContribution, Domain} from '@ali/ide-core-browser';
import { LayoutContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { TerminalView } from './terminal.view';
import { TerminalClient } from './terminal.client';
import { BottomPanelService } from '@ali/ide-bottom-panel/lib/browser/bottom-panel.service';

@Injectable()
export class Terminal2Module extends BrowserModule {
  providers: Provider[] = [
    TerminalContribution,
  ];

  backServices = [
    {
      servicePath: 'terminalService',
      clientToken: TerminalClient,
    },
  ];

}

@Domain(ClientAppContribution, LayoutContribution)
export class TerminalContribution implements LayoutContribution, ClientAppContribution {
  @Autowired()
  private bottomPanelService: BottomPanelService;

  onStart() {
    // this.bottomPanelService.append({title: '终端', component: TerminalView});
  }
  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-terminal2', {
      component: TerminalView,
      title: '终端',
    });
  }
}
