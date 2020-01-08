import { Injectable, Autowired } from '@ali/common-di';
import { Disposable, Domain, CommandContribution, CommandRegistry, CommandService } from '@ali/ide-core-common';
import { AbstractMenuService, IMenu, ICtxMenuRenderer, NextMenuContribution, IMenuRegistry, generateMergedCtxMenu, getTabbarCommonMenuId } from '@ali/ide-core-browser/lib/menu/next';
import { memoize, IContextKeyService, localize, KeybindingContribution, KeybindingRegistry, PreferenceService, IPreferenceSettingsService, COMMON_COMMANDS, getSlotLocation, AppConfig, getTabbarCtxKey } from '@ali/ide-core-browser';
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
  rename = 'terminal:rename',
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

  @Autowired(IPreferenceSettingsService)
  settingService: IPreferenceSettingsService;

  @Autowired(CommandService)
  commands: CommandService;

  @Autowired(AppConfig)
  config: AppConfig;

  registerCommands(registry: CommandRegistry) {

    /** Tab 右键菜单和 Toolbar 使用的 command */
    registry.registerCommand({ id: SimpleCommonds.split }, {
      execute: async () => {
        this.terminalController.addWidget();
      },
    });

    registry.registerCommand({ id: SimpleCommonds.stopGroup }, {
      execute: async (_: any, index: number) => {
        if (index !== -1) {
          this.tabManager.remove(index);
        }
      },
    });

    registry.registerCommand({ id: SimpleCommonds.rename }, {
      execute: async (args: any) => {
        if (args && args.id) {
          this.tabManager.addEditable(args.id);
        }
      },
    });

    registry.registerCommand({ id: SimpleCommonds.search }, {
      execute: async () => {
        this.terminalController.openSearchInput();
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
        this.commands.executeCommand(COMMON_COMMANDS.OPEN_PREFERENCES.id);
        this.settingService.setCurrentGroup('terminal');
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
      order: 1,
      group,
    });

    menuRegistry.registerMenuItem(MenuId.TermTab, {
      command: {
        id: SimpleCommonds.rename,
        label: localize('terminal.menu.rename'),
      },
      order: 2,
      group,
    });

    menuRegistry.registerMenuItem(MenuId.TermTab, {
      command: {
        id: SimpleCommonds.stopGroup,
        label: localize('terminal.menu.stopGroup'),
      },
      order: 3,
      group,
    });
    /** end */

    const location = getSlotLocation('@ali/ide-terminal-next', this.config.layoutConfig);
    const tabbarCtxKey = getTabbarCtxKey(location);
    const commonMenuId = getTabbarCommonMenuId(location);
    const when = `${tabbarCtxKey} == terminal`;
    /** 更多菜单 */
    menuRegistry.registerMenuItem(commonMenuId, {
      command: {
        id: SimpleCommonds.clearGroups,
        label: localize('terminal.menu.clearGroups'),
      },
      order: 1,
      group: more1,
      when,
    });

    menuRegistry.registerMenuItem(commonMenuId, {
      command: {
        id: SimpleCommonds.stopGroups,
        label: localize('terminal.menu.stopGroups'),
      },
      order: 1,
      group: more1,
      when,
    });

    menuRegistry.registerMenuItem(commonMenuId, {
      label: localize('terminal.menu.selectType'),
      submenu: 'tabbar_bottom_select_sub',
      order: 1,
      group: more2,
      when,
    });

    menuRegistry.registerMenuItems('tabbar_bottom_select_sub', [{
      command: {
        id: SimpleCommonds.selectTypeZsh,
        label: 'zsh',
      },
      order: 1,
      group: more1Sub,
      toggledWhen: 'config.terminal.type == zsh',
      when,
    }, {
      command: {
        id: SimpleCommonds.selectTypeBash,
        label: 'bash',
      },
      order: 2,
      group: more1Sub,
      toggledWhen: 'config.terminal.type == bash',
      when,
    }, {
      command: {
        id: SimpleCommonds.selectTypeSh,
        label: 'sh',
      },
      order: 3,
      group: more1Sub,
      toggledWhen: 'config.terminal.type == sh',
      when,
    }]);

    menuRegistry.registerMenuItem(commonMenuId, {
      command: {
        id: SimpleCommonds.moreSettings,
        label: localize('terminal.menu.moreSettings'),
      },
      order: 1,
      group: more2,
      when,
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

  @Autowired()
  tabManager: TabManager;

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
      args: [],
    });
  }

  @memoize get tabContextMenu(): IMenu {
    const contributedContextMenu = this.menuService.createMenu(MenuId.TermTab, this.contextKeyService);
    this.addDispose(contributedContextMenu);
    return contributedContextMenu;
  }

  onTabContextMenu(event: React.MouseEvent<HTMLElement>, index: number) {
    event.preventDefault();

    const { x, y } = event.nativeEvent;
    const menus = this.tabContextMenu;
    const menuNodes = generateMergedCtxMenu({ menus });

    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: [ event.target, index ],
    });
  }
}
