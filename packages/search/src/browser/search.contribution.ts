import * as copy from 'copy-to-clipboard';
import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command, DisposableCollection } from '@ali/ide-core-common';
import { localize, PreferenceSchema } from '@ali/ide-core-browser';
import { KeybindingContribution, KeybindingRegistry, ClientAppContribution, ComponentRegistry, ComponentContribution, PreferenceContribution } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { IMainLayoutService } from '@ali/ide-main-layout/lib/common';
import { TabBarToolbarRegistry, TabBarToolbarContribution } from '@ali/ide-core-browser/lib/layout';
import { MainLayoutContribution } from '@ali/ide-main-layout';
import { MenuId, NextMenuContribution, IMenuRegistry } from '@ali/ide-core-browser/lib/menu/next';
import { getIcon } from '@ali/ide-core-browser/lib/icon';
import { Search } from './search.view';
import { ContentSearchClientService } from './search.service';
import { searchPreferenceSchema } from './search-preferences';
import { SEARCH_CONTAINER_ID, SearchBindingContextIds } from '../common/content-search';
import { SearchTreeService } from './search-tree.service';
import { ContentSearchResult, ISearchTreeItem } from '../common';

const openSearchCmd: Command = {
  id: 'content-search.openSearch',
  category: 'search',
  label: 'Open search sidebar',
};

export const searchRefresh: Command = {
  id: 'file-search.refresh',
  label: 'refresh search',
  iconClass: getIcon('refresh'),
  category: 'search',
};

export const searchClean: Command = {
  id: 'file-search.clean',
  label: 'clean search',
  iconClass: getIcon('clear'),
  category: 'search',
};

export const searchFold: Command = {
  id: 'file-search.fold',
  label: 'fold search',
  iconClass: getIcon('fold'),
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

export const menuReplaceCmd: Command = {
  id: 'search.menu.replace',
  category: 'search',
  label: '%search.replace.title%',
};

export const menuReplaceAllCmd: Command = {
  id: 'search.menu.replaceAll',
  category: 'search',
  label: '%search.replaceAll.label%',
};

export const menuHideCmd: Command = {
  id: 'search.menu.hide',
  category: 'search',
  label: '%search.result.hide%',
};

export const menuCopyCmd: Command = {
  id: 'search.menu.copy',
  category: 'search',
  label: '%file.copy.file%',
};

export const menuCopyAllCmd: Command = {
  id: 'search.menu.copyAll',
  category: 'search',
  label: '%search.menu.copyAll%',
};

export const menuCopyPathCmd: Command = {
  id: 'search.menu.copyPath',
  category: 'search',
  label: '%file.copy.path%',
};

@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, ComponentContribution, TabBarToolbarContribution, PreferenceContribution, MainLayoutContribution, NextMenuContribution)
export class SearchContribution implements CommandContribution, KeybindingContribution, ComponentContribution, TabBarToolbarContribution, PreferenceContribution, MainLayoutContribution, NextMenuContribution {

  @Autowired(IMainLayoutService)
  mainLayoutService: IMainLayoutService;

  @Autowired(ContentSearchClientService)
  searchBrowserService: ContentSearchClientService;

  @Autowired(SearchTreeService)
  searchTreeService: SearchTreeService;

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
        this.searchTreeService.foldTree();
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
    commands.registerCommand(menuReplaceCmd, {
      execute: (e) => {
        this.searchTreeService.commandActuator(
          'replaceResult',
          e.id,
        );
      },
      isVisible: () => {
        return !this.searchTreeService.isContextmenuOnFile;
      },
    });
    commands.registerCommand(menuReplaceAllCmd, {
      execute: (e) => {
        this.searchTreeService.commandActuator(
          'replaceResults',
          e.id,
        );
      },
      isVisible: () => {
        return this.searchTreeService.isContextmenuOnFile;
      },
    });
    commands.registerCommand(menuHideCmd, {
      execute: (e) => {
        if (this.searchTreeService.isContextmenuOnFile) {
          return this.searchTreeService.commandActuator(
            'closeResults',
            e.id,
          );
        }
        this.searchTreeService.commandActuator(
          'closeResult',
          e.id,
        );
      },
    });
    commands.registerCommand(menuCopyCmd, {
      execute: (e) => {
        const data: ISearchTreeItem = e.file;
        const result: ContentSearchResult | undefined = data.searchResult;

        if (result) {
          copy(`  ${result.line},${result.matchStart}:  ${result.lineText}`);
        } else {
          let text = `\n ${data.uri!.withoutScheme().toString()} \n`;

          data.children!.forEach((child: ISearchTreeItem) => {
            const result = child.searchResult!;
            text = text + `  ${result.line},${result.matchStart}:  ${result.lineText} \n`;
          });

          copy(text);
        }
      },
    });
    commands.registerCommand(menuCopyAllCmd, {
      execute: (e) => {
        const nodes = this.searchTreeService._nodes;
        let copyText = '';

        nodes.forEach((node: ISearchTreeItem) => {
          if (!node.children) {
            return;
          }
          let text = `\n ${node.uri!.withoutScheme().toString()} \n`;

          node.children.forEach((child: ISearchTreeItem) => {
            const result = child.searchResult!;
            text = text + `  ${result.line},${result.matchStart}:  ${result.lineText} \n`;
          });
          copyText = copyText + text;
        });

        copy(copyText);
      },
    });
    commands.registerCommand(menuCopyPathCmd, {
      execute: (e) => {
        if (e.path) {
          copy(e.path);
        }
      },
      isVisible: () => {
        return this.searchTreeService.isContextmenuOnFile;
      },
    });
  }

  registerNextMenus(menuRegistry: IMenuRegistry): void {
    menuRegistry.registerMenuItem(MenuId.SearchContext, {
      command: menuReplaceCmd,
      order: 1,
      group: '0_0',
    });
    menuRegistry.registerMenuItem(MenuId.SearchContext, {
      command: menuReplaceAllCmd,
      order: 2,
      group: '0_0',
    });
    menuRegistry.registerMenuItem(MenuId.SearchContext, {
      command: menuHideCmd,
      order: 3,
      group: '0_0',
    });
    menuRegistry.registerMenuItem(MenuId.SearchContext, {
      command: menuCopyCmd,
      order: 1,
      group: '1_1',
    });
    menuRegistry.registerMenuItem(MenuId.SearchContext, {
      command: menuCopyPathCmd,
      order: 2,
      group: '1_1',
    });
    menuRegistry.registerMenuItem(MenuId.SearchContext, {
      command: menuCopyAllCmd,
      order: 3,
      group: '1_1',
    });
  }

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
      iconClass: getIcon('search'),
      title: localize('search.title'),
      priority: 9,
      activateKeyBinding: 'shift+command+f',
    });
  }

  registerToolbarItems(registry: TabBarToolbarRegistry) {
    // registry.registerItem({
    //   id: searchFold.id,
    //   command: searchFold.id,
    //   viewId: 'ide-search',
    //   tooltip: localize('search.CollapseDeepestExpandedLevelAction.label'),
    // });
    registry.registerItem({
      id: searchClean.id,
      command: searchClean.id,
      viewId: 'ide-search',
      tooltip: localize('search.ClearSearchResultsAction.label'),
    });
    registry.registerItem({
      id: searchRefresh.id,
      command: searchRefresh.id,
      viewId: 'ide-search',
      tooltip: localize('search.RefreshAction.label'),
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
      handler.onInActivate(() => {
        this.searchTreeService.removeHighlightRange();
      });
    }
  }

  dispose() {
    this.toDispose.dispose();
  }
}
