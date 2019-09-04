import { Provider, Injectable, Autowired } from '@ali/common-di';
import { BrowserModule, Domain} from '@ali/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { TerminalView, InputView } from './terminal.view';
import { TerminalClient } from './terminal.client';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@ali/ide-activity-panel/lib/browser/tab-bar-toolbar';
import { MainLayoutContribution, IMainLayoutService } from '@ali/ide-main-layout';
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

@Domain(ComponentContribution, TabBarToolbarContribution, MainLayoutContribution)
export class TerminalContribution implements ComponentContribution, TabBarToolbarContribution, MainLayoutContribution {

  @Autowired(IMainLayoutService)
  layoutService: IMainLayoutService;

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-terminal2', {
      component: TerminalView,
      id: 'ide-terminal2',
    }, {
      title: '终端',
      weight: 10,
      activateKeyBinding: 'ctrl+`',
      containerId: 'terminal',
    });
  }

  registerToolbarItems(registry: TabBarToolbarRegistry) {
    // registry.registerItem({
    //   id: 'terminal.clear',
    //   command: 'filetree.collapse.all',
    //   viewId: 'terminal',
    // });
  }

  onDidUseConfig() {
    const handler = this.layoutService.getTabbarHandler('terminal');
    handler.setTitleComponent(InputView);
  }
}
