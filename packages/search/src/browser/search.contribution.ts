import { Autowired } from '@opensumi/di';
import { localize, PreferenceSchema, SEARCH_COMMANDS, IClipboardService } from '@opensumi/ide-core-browser';
import {
  KeybindingContribution,
  KeybindingRegistry,
  ClientAppContribution,
  ComponentRegistry,
  ComponentContribution,
  PreferenceContribution,
} from '@opensumi/ide-core-browser';
import { getIcon } from '@opensumi/ide-core-browser';
import { SEARCH_CONTAINER_ID } from '@opensumi/ide-core-browser/lib/common/container-id';
import { SearchInputBoxFocusedKey } from '@opensumi/ide-core-browser/lib/contextkey/search';
import { ToolbarRegistry, TabBarToolbarContribution } from '@opensumi/ide-core-browser/lib/layout';
import { MenuId, MenuContribution, IMenuRegistry } from '@opensumi/ide-core-browser/lib/menu/next';
import {
  CommandContribution,
  CommandRegistry,
  DisposableCollection,
  formatLocalize,
  MessageType,
} from '@opensumi/ide-core-common';
import { Domain } from '@opensumi/ide-core-common/lib/di-helper';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser/index';
import { MainLayoutContribution } from '@opensumi/ide-main-layout';
import { IMainLayoutService } from '@opensumi/ide-main-layout/lib/common';
import { IDialogService } from '@opensumi/ide-overlay';
import { IWorkspaceEditService } from '@opensumi/ide-workspace-edit';

import { ContentSearchResult, IContentSearchClientService, OpenSearchCmdOptions } from '../common';

import { replaceAll } from './replace';
import { searchPreferenceSchema } from './search-preferences';
import { Search } from './search.view';
import { SearchTreeService } from './tree/search-tree.service';
import { SearchModelService } from './tree/tree-model.service';
import { SearchContentNode, SearchFileNode } from './tree/tree-node.defined';

@Domain(
  ClientAppContribution,
  CommandContribution,
  KeybindingContribution,
  ComponentContribution,
  TabBarToolbarContribution,
  PreferenceContribution,
  MainLayoutContribution,
  MenuContribution,
)
export class SearchContribution
  implements
    CommandContribution,
    KeybindingContribution,
    ComponentContribution,
    TabBarToolbarContribution,
    PreferenceContribution,
    MainLayoutContribution,
    MenuContribution
{
  @Autowired(IMainLayoutService)
  private readonly mainLayoutService: IMainLayoutService;

  @Autowired(IContentSearchClientService)
  private readonly searchBrowserService: IContentSearchClientService;

  @Autowired(SearchTreeService)
  private readonly searchTreeService: SearchTreeService;

  @Autowired(IEditorDocumentModelService)
  private readonly documentModelManager: IEditorDocumentModelService;

  @Autowired(IWorkspaceEditService)
  private readonly workspaceEditService: IWorkspaceEditService;

  @Autowired(IDialogService)
  private readonly dialogService: IDialogService;

  @Autowired(SearchModelService)
  private readonly searchModelService: SearchModelService;

  @Autowired(IClipboardService)
  private readonly clipboardService: IClipboardService;

  schema: PreferenceSchema = searchPreferenceSchema;

  private readonly toDispose = new DisposableCollection();

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
          this.searchBrowserService.updateUIState({ isDetailOpen: true });
          this.searchBrowserService.search();
          return;
        }
        this.searchBrowserService.searchEditorSelection();
        this.searchBrowserService.focus();
        this.searchBrowserService.search();
      },
    });
    commands.registerCommand(SEARCH_COMMANDS.REFRESH, {
      execute: () => {
        this.searchBrowserService.search();
      },
    });
    commands.registerCommand(SEARCH_COMMANDS.CLEAN, {
      execute: () => {
        this.searchBrowserService.clean();
      },
    });
    commands.registerCommand(SEARCH_COMMANDS.GET_RECENT_SEARCH_WORD, {
      execute: (e) => {
        this.searchBrowserService.setRecentSearchWord();
      },
    });
    commands.registerCommand(SEARCH_COMMANDS.GET_BACK_RECENT_SEARCH_WORD, {
      execute: () => {
        this.searchBrowserService.setBackRecentSearchWord();
      },
    });
    commands.registerCommand(SEARCH_COMMANDS.MENU_REPLACE, {
      execute: async (node: SearchFileNode | SearchContentNode) => {
        if (!SearchFileNode.is(node)) {
          const resultMap: Map<string, ContentSearchResult[]> = new Map();
          resultMap.set(node.resource.toString(), [node.contentResult]);
          await replaceAll(
            this.documentModelManager,
            this.workspaceEditService,
            resultMap,
            this.searchBrowserService.replaceValue,
            this.searchBrowserService.searchValue,
            this.searchBrowserService.UIState.isUseRegexp,
          );
        }
      },
      isVisible: () => !SearchFileNode.is(this.searchModelService.contextMenuNode),
    });
    commands.registerCommand(SEARCH_COMMANDS.MENU_REPLACE_ALL, {
      execute: async (node: SearchFileNode | SearchContentNode) => {
        if (!SearchFileNode.is(node)) {
          return;
        }
        const resultMap: Map<string, ContentSearchResult[]> = new Map();
        if (!node.children) {
          return;
        }
        const contentSearchResult: ContentSearchResult[] = node.children.map(
          (child: SearchContentNode) => child.contentResult,
        );
        const buttons = {
          [localize('search.replace.buttonCancel')]: false,
          [localize('search.replace.buttonOK')]: true,
        };
        const selection = await this.dialogService.open(
          formatLocalize('search.removeAll.occurrences.file.confirmation.message', String(contentSearchResult.length)),
          MessageType.Warning,
          Object.keys(buttons),
        );
        if (selection && !buttons[selection]) {
          return buttons[selection];
        }
        resultMap.set(node.resource.toString(), contentSearchResult);
        await replaceAll(
          this.documentModelManager,
          this.workspaceEditService,
          resultMap,
          this.searchBrowserService.replaceValue,
          this.searchBrowserService.searchValue,
          this.searchBrowserService.UIState.isUseRegexp,
        );
      },
      isVisible: () => !SearchFileNode.is(this.searchModelService.contextMenuNode),
    });
    commands.registerCommand(SEARCH_COMMANDS.MENU_HIDE, {
      execute: (node: SearchFileNode | SearchContentNode) => {
        if (SearchFileNode.is(node)) {
          this.searchBrowserService.resultTotal.fileNum -= 1;
          this.searchBrowserService.resultTotal.resultNum -= node.branchSize;
          this.searchModelService.treeModel.root.unlinkItem(node);
        } else {
          this.searchBrowserService.resultTotal.resultNum -= 1;
          if (node.parent?.children?.length === 1) {
            this.searchBrowserService.resultTotal.fileNum -= 1;
            this.searchModelService.treeModel.root.unlinkItem(node.parent);
          }
          (node.parent as SearchFileNode).unlinkItem(node);
        }
        this.searchBrowserService.fireTitleChange();
      },
    });
    commands.registerCommand(SEARCH_COMMANDS.MENU_COPY, {
      execute: (node: SearchFileNode | SearchContentNode) => {
        if (!SearchFileNode.is(node)) {
          const result = node.contentResult;
          this.clipboardService.writeText(`${result.line},${result.matchStart}:  ${result.renderLineText}`);
        } else {
          const uri = node.resource;
          let text = `${uri.codeUri.fsPath.toString()}\n`;

          node.children?.forEach((node: SearchContentNode) => {
            const result = node.contentResult;
            text = text + `${result.line},${result.matchStart}: ${result.renderLineText} \n`;
          });
          this.clipboardService.writeText(text);
        }
      },
    });
    commands.registerCommand(SEARCH_COMMANDS.MENU_COPY_ALL, {
      execute: (node: SearchFileNode | SearchContentNode) => {
        let nodes: SearchFileNode[];
        if (!node) {
          nodes = this.searchModelService.treeModel.root.children as SearchFileNode[];
        } else {
          if (SearchFileNode.is(node)) {
            nodes = [node];
          } else {
            nodes = [node.parent as SearchFileNode];
          }
        }
        if (!nodes) {
          return;
        }
        let copyText = '';

        for (let i = 0, len = nodes.length; i < len; i++) {
          const uri = nodes[i].resource;
          let text = `${uri.codeUri.fsPath.toString()}\n`;
          nodes[i].children?.forEach((node: SearchContentNode) => {
            const result = node.contentResult;
            text = text + `${result.line},${result.matchStart}: ${result.renderLineText} \n`;
          });
          copyText += text;
          if (i < len) {
            copyText += '\n';
          }
        }
        this.clipboardService.writeText(copyText);
      },
    });
    commands.registerCommand(SEARCH_COMMANDS.MENU_COPY_PATH, {
      execute: (node: SearchFileNode | SearchContentNode) => {
        this.clipboardService.writeText(node.resource.codeUri.fsPath.toString());
      },
    });
  }

  registerMenus(menuRegistry: IMenuRegistry): void {
    menuRegistry.registerMenuItem(MenuId.SearchContext, {
      command: SEARCH_COMMANDS.MENU_REPLACE.id,
      order: 1,
      group: '0_operator',
    });
    menuRegistry.registerMenuItem(MenuId.SearchContext, {
      command: SEARCH_COMMANDS.MENU_REPLACE_ALL.id,
      order: 2,
      group: '0_operator',
    });
    menuRegistry.registerMenuItem(MenuId.SearchContext, {
      command: SEARCH_COMMANDS.MENU_HIDE.id,
      order: 3,
      group: '0_operator',
    });
    menuRegistry.registerMenuItem(MenuId.SearchContext, {
      command: SEARCH_COMMANDS.MENU_COPY.id,
      order: 1,
      group: '1_copy',
    });
    menuRegistry.registerMenuItem(MenuId.SearchContext, {
      command: SEARCH_COMMANDS.MENU_COPY_PATH.id,
      order: 2,
      group: '1_copy',
    });
    menuRegistry.registerMenuItem(MenuId.SearchContext, {
      command: SEARCH_COMMANDS.MENU_COPY_ALL.id,
      order: 3,
      group: '1_copy',
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
      when: SearchInputBoxFocusedKey.raw,
    });
    keybindings.registerKeybinding({
      command: SEARCH_COMMANDS.GET_RECENT_SEARCH_WORD.id,
      keybinding: 'up',
      when: SearchInputBoxFocusedKey.raw,
    });
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('@opensumi/ide-search', [], {
      containerId: SEARCH_CONTAINER_ID,
      iconClass: getIcon('search'),
      title: localize('search.title'),
      component: Search,
      priority: 9,
      activateKeyBinding: 'ctrlcmd+shift+f',
    });
  }

  registerToolbarItems(registry: ToolbarRegistry) {
    registry.registerItem({
      id: SEARCH_COMMANDS.CLEAN.id,
      command: SEARCH_COMMANDS.CLEAN.id,
      viewId: SEARCH_CONTAINER_ID,
      tooltip: localize('search.ClearSearchResultsAction.label'),
      enabledWhen: 'canClearSearchResult',
    });
    registry.registerItem({
      id: SEARCH_COMMANDS.REFRESH.id,
      command: SEARCH_COMMANDS.REFRESH.id,
      viewId: SEARCH_CONTAINER_ID,
      tooltip: localize('search.RefreshAction.label'),
      enabledWhen: 'canRefreshSearchResult',
    });
  }

  onDidRender() {
    const handler = this.mainLayoutService.getTabbarHandler(SEARCH_CONTAINER_ID);
    if (handler) {
      handler.onActivate(() => {
        this.searchBrowserService.initSearchHistory();
        this.searchBrowserService.focus();
      });
      handler.onInActivate(() => {
        this.searchTreeService.removeHighlightRange();
        this.searchBrowserService.blur();
      });
    }
  }

  dispose() {
    this.toDispose.dispose();
  }
}
