import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command, DisposableCollection } from '@ali/ide-core-common';
import { localize, PreferenceSchema } from '@ali/ide-core-browser';
import { KeybindingContribution, KeybindingRegistry, ClientAppContribution, ComponentRegistry, ComponentContribution, PreferenceContribution } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { IMainLayoutService } from '@ali/ide-main-layout/lib/common';
import { TabBarToolbarRegistry, TabBarToolbarContribution } from '@ali/ide-activity-panel/lib/browser/tab-bar-toolbar';
import { MainLayoutContribution } from '@ali/ide-main-layout';
import { Search } from './search.view';
import { SearchBrowserService } from './search.service';
import { searchPreferenceSchema } from './search-preferences';
import { SEARCH_CONTAINER_ID, SearchBindingContextIds } from '../common/content-search';

const openSearchCmd: Command = {
  id: 'content-search.openSearch',
  category: 'search',
  label: 'Open search sidebar',
};

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

export const getRecentSearchWordCmd: Command = {
  id: 'search.getRecentSearchWordCmd',
  category: 'search',
};

export const getBackRecentSearchWordCmd: Command = {
  id: 'search.getBackRecentSearchWordCmd',
  category: 'search',
};

@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, MenuContribution, ComponentContribution, TabBarToolbarContribution, PreferenceContribution, MainLayoutContribution)
export class SearchContribution implements CommandContribution, KeybindingContribution, MenuContribution, ComponentContribution, TabBarToolbarContribution, PreferenceContribution, MainLayoutContribution {

  @Autowired(IMainLayoutService)
  mainLayoutService: IMainLayoutService;

  @Autowired(SearchBrowserService)
  searchBrowserService: SearchBrowserService;

  schema: PreferenceSchema = searchPreferenceSchema;

  private readonly toDispose = new DisposableCollection();

  constructor() {
    this.toDispose.push(this.searchBrowserService.onTitleStateChange(() => {
      const bar = this.mainLayoutService.getTabbarHandler(SEARCH_CONTAINER_ID);
      if (!bar) {
        return;
      }
      bar.refreshTitle();
    }));
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(openSearchCmd, {
      execute: (...args: any[]) => {
        const bar = this.mainLayoutService.getTabbarHandler(SEARCH_CONTAINER_ID);
        if (!bar) {
          return;
        }
        bar.activate();
        this.searchBrowserService.setSearchValueFromActivatedEditor();
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
    commands.registerCommand(getRecentSearchWordCmd, {
      execute: (e) => {
        this.searchBrowserService.searchHistory.setRecentSearchWord();
      },
    });
    commands.registerCommand(getBackRecentSearchWordCmd, {
      execute: (e) => {
        this.searchBrowserService.searchHistory.setBackRecentSearchWord();
      },
    });
  }

  registerMenus(menus: MenuModelRegistry): void {}

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: openSearchCmd.id,
      keybinding: 'ctrlcmd+shift+f',
    });

    keybindings.registerKeybinding({
      command: getBackRecentSearchWordCmd.id,
      keybinding: 'down',
      context: SearchBindingContextIds.searchInputFocus,
    });
    keybindings.registerKeybinding({
      command: getRecentSearchWordCmd.id,
      keybinding: 'up',
      context: SearchBindingContextIds.searchInputFocus,
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
      priority: 8,
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

  onDidUseConfig() {
    const handler = this.mainLayoutService.getTabbarHandler(SEARCH_CONTAINER_ID);
    if (handler) {
      handler.onActivate(() => {
        this.searchBrowserService.setSearchValueFromActivatedEditor();
        this.searchBrowserService.focus();
        this.searchBrowserService.searchHistory.initSearchHistory();
      });
    }
  }

  dispose() {
    this.toDispose.dispose();
  }
}
