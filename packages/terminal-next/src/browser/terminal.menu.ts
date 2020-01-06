import { Injectable, Autowired } from '@ali/common-di';
import { Disposable, Domain, CommandContribution, CommandRegistry } from '@ali/ide-core-common';
import { AbstractMenuService, IMenu, ICtxMenuRenderer, NextMenuContribution, IMenuRegistry, generateMergedCtxMenu } from '@ali/ide-core-browser/lib/menu/next';
import { memoize, IContextKeyService, localize, KeybindingContribution, KeybindingRegistry, PreferenceService } from '@ali/ide-core-browser';
import { ITerminalController, terminalFocusContextKey, TerminalSupportType } from '../common';
import { TerminalClient } from './terminal.client';
import { TabManager } from './component/tab/manager';

export enum MenuId {
  TermTab = 'TermTab',
  TermPanel = 'TermPanel',
}

export enum SimpleCommonds {
  search = 'terminalsearch',
  split = 'terminal:split',
  selectAll = 'terminal:selectAll',
  copy = 'terminal:copy',
  paste = 'terminal:paste',
  clearGroups = 'terminal:clear',
  stop = 'terminal:stop',
  stopGroup = 'terminal:stopGroup',
  stopGroups = 'terminal:stopGroups',
  selectType = 'terminal:selectType',
  moreSettings = 'terminal:moreSettings',
  selectTypeZsh = 'terminal:selectTypeZsh',
  selectTypeBash = 'terminal:selectTypeBash',
  selectTypeSh = 'terminal:selectTypeSh',
}

export const group = 'panel_menu';
export const more1 = 'more_1';
export const more1Sub = 'more_1_sub';
export const more2 = 'more_2';

@Domain(NextMenuContribution, CommandContribution, KeybindingContribution)
export class TerminalMenuContribution implements NextMenuContribution, CommandContribution, KeybindingContribution {

  @Autowired(ITerminalController)
  terminalController: ITerminalController;

  @Autowired()
  tabManager: TabManager;

  @Autowired(PreferenceService)
  preference: PreferenceService;

  registerCommands(registry: CommandRegistry) {

    /** Tab 右键菜单和 Toolbar 使用的 command */
    registry.registerCommand({ id: SimpleCommonds.search }, {
      execute: async () => {
        this.terminalController.openSearchInput();
      },
    });

    registry.registerCommand({ id: SimpleCommonds.split }, {
      execute: async () => {
        this.terminalController.addWidget();
      },
    });

    registry.registerCommand({ id: SimpleCommonds.stopGroup }, {
      execute: async () => {
        if (this.terminalController.state.index !== -1) {
          this.tabManager.remove(this.terminalController.state.index);
        }
      },
    });

    registry.registerCommand({ id: SimpleCommonds.selectAll }, {
      execute: async () => {
        const client = this.terminalController.getCurrentClient() as TerminalClient;
        if (client) {
          client.selectAll();
        }
      },
    });
    /** end */

    /** 更多菜单 command */
    registry.registerCommand({ id: SimpleCommonds.clearGroups }, {
      execute: async () => {
        this.terminalController.clearAllGroups();
      },
    });

    registry.registerCommand({ id: SimpleCommonds.stopGroups }, {
      execute: async () => {
        this.terminalController.removeAllGroups();
      },
    });

    registry.registerCommand({ id: SimpleCommonds.selectTypeZsh }, {
      execute: async () => {
        this.preference.set('terminal.type', 'zsh');
      },
    });

    registry.registerCommand({ id: SimpleCommonds.selectTypeBash }, {
      execute: async () => {
        this.preference.set('terminal.type', 'bash');
      },
    });

    registry.registerCommand({ id: SimpleCommonds.selectTypeSh }, {
      execute: async () => {
        this.preference.set('terminal.type', 'sh');
      },
    });

    registry.registerCommand({ id: SimpleCommonds.moreSettings }, {
      execute: async () => {

      },
    });
    /** end */
  }

  registerKeybindings(registry: KeybindingRegistry) {
    registry.registerKeybinding({
      command: SimpleCommonds.search,
      keybinding: 'ctrlcmd+f',
      when: terminalFocusContextKey,
    });
  }

  registerNextMenus(menuRegistry: IMenuRegistry) {
    /** 终端 Tab 菜单 */
    menuRegistry.registerMenuItem(MenuId.TermTab, {
      command: {
        id: SimpleCommonds.split,
        label: localize('terminal.menu.split'),
      },
      order: 2,
      group,
    });

    menuRegistry.registerMenuItem(MenuId.TermTab, {
      command: {
        id: SimpleCommonds.stopGroup,
        label: localize('terminal.menu.stopGroup'),
      },
      order: 1,
      group,
    });
    /** end */

    /** 更多菜单 */
    menuRegistry.registerMenuItem(`tabbar/bottom/common`, {
      command: {
        id: SimpleCommonds.clearGroups,
        label: localize('terminal.menu.clearGroups'),
      },
      order: 1,
      group: more1,
    });

    menuRegistry.registerMenuItem(`tabbar/bottom/common`, {
      command: {
        id: SimpleCommonds.stopGroups,
        label: localize('terminal.menu.stopGroups'),
      },
      order: 1,
      group: more1,
    });

    menuRegistry.registerMenuItem(`tabbar/bottom/common`, {
      label: localize('terminal.menu.selectType'),
      submenu: 'tabbar_bottom_select_sub',
      order: 1,
      group: more2,
    });

    menuRegistry.registerMenuItems('tabbar_bottom_select_sub', [{
      command: {
        id: SimpleCommonds.selectTypeZsh,
        label: 'zsh',
      },
      order: 1,
      group: more1Sub,
      toggledWhen: 'config.terminal.type == zsh',
    }, {
      command: {
        id: SimpleCommonds.selectTypeBash,
        label: 'bash',
      },
      order: 2,
      group: more1Sub,
      toggledWhen: 'config.terminal.type == bash',
    }, {
      command: {
        id: SimpleCommonds.selectTypeSh,
        label: 'sh',
      },
      order: 3,
      group: more1Sub,
      toggledWhen: 'config.terminal.type == sh',
    }]);

    menuRegistry.registerMenuItem(`tabbar/bottom/common`, {
      command: {
        id: SimpleCommonds.moreSettings,
        label: localize('terminal.menu.moreSettings'),
      },
      order: 1,
      group: more2,
    });
    /** end */
  }
}

@Injectable()
export class TerminalContextMenuService extends Disposable {
  @Autowired(AbstractMenuService)
  private readonly menuService: AbstractMenuService;

  @Autowired(ICtxMenuRenderer)
  private readonly ctxMenuRenderer: ICtxMenuRenderer;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  @memoize get contextMenu(): IMenu {
    const contributedContextMenu = this.menuService.createMenu(MenuId.TermPanel, this.contextKeyService);
    this.addDispose(contributedContextMenu);
    return contributedContextMenu;
  }

  onContextMenu(event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();

    const { x, y } = event.nativeEvent;
    const menus = this.contextMenu;
    const menuNodes = generateMergedCtxMenu({ menus });

    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: [ 'some args for command executor' ],
    });
  }

  @memoize get tabContextMenu(): IMenu {
    const contributedContextMenu = this.menuService.createMenu(MenuId.TermTab, this.contextKeyService);
    this.addDispose(contributedContextMenu);
    return contributedContextMenu;
  }

  onTabContextMenu(event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();

    const { x, y } = event.nativeEvent;
    const menus = this.tabContextMenu;
    const menuNodes = generateMergedCtxMenu({ menus });

    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: [ 'some args for command executor' ],
    });
  }
}
