import { Injectable, Autowired } from '@ali/common-di';
import { Disposable, Domain, CommandContribution, CommandRegistry } from '@ali/ide-core-common';
import { AbstractMenuService, IMenu, ICtxMenuRenderer, NextMenuContribution, IMenuRegistry, generateMergedCtxMenu } from '@ali/ide-core-browser/lib/menu/next';
import { memoize, IContextKeyService, localize, KeybindingContribution, KeybindingRegistry } from '@ali/ide-core-browser';
import { ITerminalController, terminalFocusContextKey } from '../common';
import { TerminalClient } from './terminal.client';
import { TabManager } from './component/tab/manager';

export enum MenuId {
  TermTab = 'TermTab',
  TermPanel = 'TermPanel',
}

export enum SimpleCommonds {
  search = 'terminal:search',
  split = 'terminal:split',
  selectAll = 'terminal:selectAll',
  copy = 'terminal:copy',
  paste = 'terminal:paste',
  clear = 'terminal:clear',
  stop = 'terminal:stop',
  stopGroup = 'terminal:stopGroup',
  moreSettings = 'terminal:moreSettings',
}

export const group = 'panel_menu';
export const more1 = 'more_1';
export const more2 = 'more_2';

@Domain(NextMenuContribution, CommandContribution, KeybindingContribution)
export class TerminalMenuContribution implements NextMenuContribution, CommandContribution, KeybindingContribution {

  @Autowired(ITerminalController)
  terminalController: ITerminalController;

  @Autowired()
  tabManager: TabManager;

  registerCommands(registry: CommandRegistry) {
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

    registry.registerCommand({ id: SimpleCommonds.selectAll }, {
      execute: async () => {
        const client = this.terminalController.getCurrentClient() as TerminalClient;
        if (client) {
          client.selectAll();
        }
      },
    });

    registry.registerCommand({ id: SimpleCommonds.copy }, {
      execute: async () => {
        const client = this.terminalController.getCurrentClient() as TerminalClient;
        if (client) {
          client.copy();
        }
      },
    });

    registry.registerCommand({ id: SimpleCommonds.clear }, {
      execute: async () => {
        const client = this.terminalController.getCurrentClient() as TerminalClient;
        if (client) {
          client.clear();
        }
      },
    });

    registry.registerCommand({ id: SimpleCommonds.stop }, {
      execute: async () => {
        this.terminalController.removeFocused();
      },
    });

    registry.registerCommand({ id: SimpleCommonds.stopGroup }, {
      execute: async () => {
        if (this.terminalController.state.index !== -1) {
          this.tabManager.remove(this.terminalController.state.index);
        }
      },
    });

    registry.registerCommand({ id: SimpleCommonds.moreSettings }, {
      execute: async () => {
        if (this.terminalController.state.index !== -1) {
          this.tabManager.remove(this.terminalController.state.index);
        }
      },
    });
  }

  registerKeybindings(registry: KeybindingRegistry) {
    registry.registerKeybinding({
      command: SimpleCommonds.search,
      keybinding: 'ctrlcmd+f',
      when: terminalFocusContextKey,
    });

    /*
    registry.registerKeybinding({
      command: SimpleCommonds.stop,
      keybinding: 'alt+shift+w',
      when: terminalFocusContextKey,
    });

    registry.registerKeybinding({
      command: SimpleCommonds.split,
      keybinding: 'alt+shift+n',
      when: terminalFocusContextKey,
    });
    */
  }

  registerNextMenus(menuRegistry: IMenuRegistry) {
    menuRegistry.registerMenuItem(MenuId.TermPanel, {
      command: {
        id: SimpleCommonds.search,
        label: localize('terminal.menu.search'),
      },
      order: 1,
      group,
    });

    menuRegistry.registerMenuItem(MenuId.TermPanel, {
      command: {
        id: SimpleCommonds.split,
        label: localize('terminal.menu.split'),
      },
      order: 2,
      group,
    });

    menuRegistry.registerMenuItem(MenuId.TermPanel, {
      command: {
        id: SimpleCommonds.selectAll,
        label: localize('terminal.menu.selectAll'),
      },
      order: 3,
      group,
    });

    menuRegistry.registerMenuItem(MenuId.TermPanel, {
      command: {
        id: SimpleCommonds.copy,
        label: localize('terminal.menu.copy'),
      },
      order: 4,
      group,
    });

    menuRegistry.registerMenuItem(MenuId.TermPanel, {
      command: {
        id: SimpleCommonds.clear,
        label: localize('terminal.menu.clear'),
      },
      order: 6,
      group,
    });

    menuRegistry.registerMenuItem(MenuId.TermPanel, {
      command: {
        id: SimpleCommonds.stop,
        label: localize('terminal.menu.stop'),
      },
      order: 7,
      group,
    });

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

    menuRegistry.registerMenuItem(`tabbar/bottom/common`, {
      command: {
        id: SimpleCommonds.clear,
        label: localize('terminal.menu.clear'),
      },
      order: 1,
      group: more1,
    });

    menuRegistry.registerMenuItem(`tabbar/bottom/common`, {
      command: {
        id: SimpleCommonds.moreSettings,
        label: localize('terminal.menu.moreSettings'),
      },
      order: 1,
      group: more2,
    });
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
