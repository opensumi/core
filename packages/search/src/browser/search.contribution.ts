import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, ClientAppContribution, ComponentRegistry, LayoutContribution } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { IMainLayoutService } from '@ali/ide-main-layout/lib/common';
import { Search } from './search.view';
import { SearchBrowserService } from './search.service';

const cmd: Command = {
  id: 'content-search.openSearch',
  category: 'search',
  label: 'Open search sidebar',
};

const containerId = 'search';

@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, MenuContribution, LayoutContribution)
export class SearchContribution implements CommandContribution, KeybindingContribution, MenuContribution, LayoutContribution {

  @Autowired(IMainLayoutService)
  mainLayoutService: IMainLayoutService;

  @Autowired(SearchBrowserService)
  searchBrowserService: SearchBrowserService;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(cmd, {
      execute: (...args: any[]) => {
        const bar = this.mainLayoutService.getTabbarHandler(containerId);
        if (!bar) {
          return;
        }
        bar.activate();
        this.searchBrowserService.focus();
      },
    });
  }

  registerMenus(menus: MenuModelRegistry): void {}

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: cmd.id,
      keybinding: 'ctrlcmd+shift+f',
    });
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-search', {
      component: Search,
      id: 'ide-search',
    }, {
      containerId,
      iconClass: 'volans_icon search',
      title: 'SEARCH',
      weight: 8,
    });
  }
}
