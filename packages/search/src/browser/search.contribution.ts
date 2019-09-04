import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command } from '@ali/ide-core-common';
import { localize } from '@ali/ide-core-browser';
import { KeybindingContribution, KeybindingRegistry, ClientAppContribution, ComponentRegistry, ComponentContribution } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { IMainLayoutService } from '@ali/ide-main-layout/lib/common';
import { TabBarToolbarRegistry, TabBarToolbarContribution } from '@ali/ide-activity-panel/lib/browser/tab-bar-toolbar';
import { Search } from './search.view';
import { SearchBrowserService } from './search.service';

const openSearchCmd: Command = {
  id: 'content-search.openSearch',
  category: 'search',
  label: 'Open search sidebar',
};

const SEARCH_CONTAINER_ID = 'search';

export const searchRefresh: Command = {
  id: 'file-search.refresh',
  label: 'refresh search',
  iconClass: 'volans_icon refresh',
  category: 'search',
};

export const searchClean: Command = {
  id: 'file-search.clean',
  label: 'clean search',
  iconClass: 'volans_icon search_close',
  category: 'search',
};

export const searchFold: Command = {
  id: 'file-search.fold',
  label: 'fold search',
  iconClass: 'volans_icon fold',
  category: 'search',
};

@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, MenuContribution, ComponentContribution, TabBarToolbarContribution)
export class SearchContribution implements CommandContribution, KeybindingContribution, MenuContribution, ComponentContribution, TabBarToolbarContribution {

  @Autowired(IMainLayoutService)
  mainLayoutService: IMainLayoutService;

  @Autowired(SearchBrowserService)
  searchBrowserService: SearchBrowserService;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(openSearchCmd, {
      execute: (...args: any[]) => {
        const bar = this.mainLayoutService.getTabbarHandler(SEARCH_CONTAINER_ID);
        if (!bar) {
          return;
        }
        bar.activate();
        this.searchBrowserService.focus();
      },
    });
    commands.registerCommand(searchRefresh, {
      execute: (...args: any[]) => {
        this.searchBrowserService.refresh();
      },
      isVisible: () => {
        return true;
      },
      isEnabled: () => {
        return this.searchBrowserService.refreshIsEnable();
      },
    });
    commands.registerCommand(searchClean, {
      execute: (...args: any[]) => {
        this.searchBrowserService.clean();
      },
      isVisible: () => {
        return true;
      },
      isEnabled: () => {
        return this.searchBrowserService.cleanIsEnable();
      },
    });
    commands.registerCommand(searchFold, {
      execute: (...args: any[]) => {
        this.searchBrowserService.fold();
      },
      isVisible: () => {
        return true;
      },
      isEnabled: () => {
        return this.searchBrowserService.foldIsEnable();
      },
    });
  }

  registerMenus(menus: MenuModelRegistry): void {}

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: openSearchCmd.id,
      keybinding: 'ctrlcmd+shift+f',
    });
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-search', {
      component: Search,
      id: 'ide-search',
    }, {
      containerId: SEARCH_CONTAINER_ID,
      iconClass: 'volans_icon search',
      title: localize('searchView'),
      weight: 8,
      activateKeyBinding: 'shift+command+f',
    });
  }

  registerToolbarItems(registry: TabBarToolbarRegistry) {
    registry.registerItem({
      id: searchFold.id,
      command: searchFold.id,
      viewId: 'ide-search',
    });
    registry.registerItem({
      id: searchClean.id,
      command: searchClean.id,
      viewId: 'ide-search',
    });
    registry.registerItem({
      id: searchRefresh.id,
      command: searchRefresh.id,
      viewId: 'ide-search',
    });
  }
}
