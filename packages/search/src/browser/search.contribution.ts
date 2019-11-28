import * as copy from 'copy-to-clipboard';
import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command, DisposableCollection } from '@ali/ide-core-common';
import { localize, PreferenceSchema, SEARCH_COMMANDS } from '@ali/ide-core-browser';
import { KeybindingContribution, KeybindingRegistry, ClientAppContribution, ComponentRegistry, ComponentContribution, PreferenceContribution } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { IMainLayoutService } from '@ali/ide-main-layout/lib/common';
import { TabBarToolbarRegistry, TabBarToolbarContribution } from '@ali/ide-core-browser/lib/layout';
import { MainLayoutContribution } from '@ali/ide-main-layout';
import { MenuId, NextMenuContribution, IMenuRegistry } from '@ali/ide-core-browser/lib/menu/next';
import { getIcon } from '@ali/ide-core-browser';
import { Search } from './search.view';
import { ContentSearchClientService } from './search.service';
import { searchPreferenceSchema } from './search-preferences';
import { SEARCH_CONTAINER_ID, SearchBindingContextIds } from '../common/content-search';
import { SearchTreeService } from './search-tree.service';
import { ContentSearchResult, ISearchTreeItem, OpenSearchCmdOptions } from '../common';

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
    commands.registerCommand(SEARCH_COMMANDS.OPEN_SEARCH, {
      execute: (options?: OpenSearchCmdOptions) => {
        const bar = this.mainLayoutService.getTabbarHandler(SEARCH_CONTAINER_ID);
        if (!bar) {
          return;
        }
        bar.activate();
        if (options && options.includeValue) {
          this.searchBrowserService.includeValue = options.includeValue;
          this.searchBrowserService.updateUIState({isDetailOpen: true });
          this.searchBrowserService.search();
          return;
        }
        this.searchBrowserService.setSearchValueFromActivatedEditor();
        this.searchBrowserService.focus();
      },
    });
    commands.registerCommand(SEARCH_COMMANDS.REFRESH, {
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
    commands.registerCommand(SEARCH_COMMANDS.CLEAN, {
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
    commands.registerCommand(SEARCH_COMMANDS.FOLD, {
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
    commands.registerCommand(SEARCH_COMMANDS.GET_RECENT_SEARCH_WORD, {
      execute: (e) => {
        this.searchBrowserService.searchHistory.setRecentSearchWord();
      },
    });
    commands.registerCommand(SEARCH_COMMANDS.GET_BACK_RECENT_SEARCH_WORD, {
      execute: (e) => {
        this.searchBrowserService.searchHistory.setBackRecentSearchWord();
      },
    });
    commands.registerCommand(SEARCH_COMMANDS.MENU_COPY, {
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
    commands.registerCommand(SEARCH_COMMANDS.MENU_REPLACE_ALL, {
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
    commands.registerCommand(SEARCH_COMMANDS.MENU_HIDE, {
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
    commands.registerCommand(SEARCH_COMMANDS.MENU_COPY, {
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
    commands.registerCommand(SEARCH_COMMANDS.MENU_COPY_ALL, {
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
    commands.registerCommand(SEARCH_COMMANDS.MENU_COPY_PATH, {
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
      command: SEARCH_COMMANDS.MENU_REPLACE.id,
      order: 1,
      group: '0_0',
    });
    menuRegistry.registerMenuItem(MenuId.SearchContext, {
      command: SEARCH_COMMANDS.MENU_REPLACE_ALL.id,
      order: 2,
      group: '0_0',
    });
    menuRegistry.registerMenuItem(MenuId.SearchContext, {
      command: SEARCH_COMMANDS.MENU_HIDE.id,
      order: 3,
      group: '0_0',
    });
    menuRegistry.registerMenuItem(MenuId.SearchContext, {
      command: SEARCH_COMMANDS.MENU_COPY.id,
      order: 1,
      group: '1_1',
    });
    menuRegistry.registerMenuItem(MenuId.SearchContext, {
      command: SEARCH_COMMANDS.MENU_COPY_PATH.id,
      order: 2,
      group: '1_1',
    });
    menuRegistry.registerMenuItem(MenuId.SearchContext, {
      command: SEARCH_COMMANDS.MENU_COPY_ALL.id,
      order: 3,
      group: '1_1',
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: SEARCH_COMMANDS.OPEN_SEARCH.id,
      keybinding: 'ctrlcmd+shift+f',
    });

    keybindings.registerKeybinding({
      command: SEARCH_COMMANDS.GET_BACK_RECENT_SEARCH_WORD.id,
      keybinding: 'down',
      context: SearchBindingContextIds.searchInputFocus,
    });
    keybindings.registerKeybinding({
      command: SEARCH_COMMANDS.GET_RECENT_SEARCH_WORD.id,
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
    registry.registerItem({
      id: SEARCH_COMMANDS.CLEAN.id,
      command: SEARCH_COMMANDS.CLEAN.id,
      viewId: 'ide-search',
      tooltip: localize('search.ClearSearchResultsAction.label'),
    });
    registry.registerItem({
      id: SEARCH_COMMANDS.REFRESH.id,
      command: SEARCH_COMMANDS.REFRESH.id,
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
