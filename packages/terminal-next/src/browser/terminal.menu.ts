import { Injectable, Autowired } from '@ali/common-di';
import { Disposable, Domain, CommandService, isWindows, isElectronRenderer } from '@ali/ide-core-common';
import { AbstractMenuService, IMenu, ICtxMenuRenderer, NextMenuContribution, IMenuRegistry, generateMergedCtxMenu, getTabbarCommonMenuId } from '@ali/ide-core-browser/lib/menu/next';
import { memoize, IContextKeyService, localize, KeybindingContribution, KeybindingRegistry, PreferenceService, IPreferenceSettingsService, getSlotLocation, AppConfig, getTabbarCtxKey } from '@ali/ide-core-browser';
import { ITerminalController, ITerminalGroupViewService, ITerminalSearchService, TERMINAL_COMMANDS } from '../common';
import { IsTerminalFocused } from '@ali/ide-core-browser/lib/contextkey';

export enum MenuId {
  TermTab = 'TermTab',
  TermPanel = 'TermPanel',
}

export const group = 'panel_menu';
export const more1 = 'more_1';
export const more1Sub = 'more_1_sub';
export const more2 = 'more_2';

@Domain(NextMenuContribution, KeybindingContribution)
export class TerminalMenuContribution implements NextMenuContribution, KeybindingContribution {

  @Autowired(ITerminalController)
  protected readonly terminalController: ITerminalController;

  @Autowired(ITerminalGroupViewService)
  protected readonly view: ITerminalGroupViewService;

  @Autowired(ITerminalSearchService)
  protected readonly search: ITerminalSearchService;

  @Autowired(PreferenceService)
  protected readonly preference: PreferenceService;

  @Autowired(IPreferenceSettingsService)
  protected readonly settingService: IPreferenceSettingsService;

  @Autowired(CommandService)
  protected readonly commands: CommandService;

  @Autowired(AppConfig)
  protected readonly config: AppConfig;

  registerKeybindings(registry: KeybindingRegistry) {
    registry.registerKeybinding({
      command: TERMINAL_COMMANDS.OPEN_SEARCH.id,
      keybinding: 'ctrlcmd+f',
      when: IsTerminalFocused.raw,
    });
    registry.registerKeybinding({
      command: TERMINAL_COMMANDS.CLEAR_CONTENT.id,
      keybinding: 'ctrlcmd+k',
      when: IsTerminalFocused.raw,
    });
    registry.registerKeybinding({
      command: TERMINAL_COMMANDS.SEARCH_NEXT.id,
      keybinding: 'ctrlcmd+g',
      when: IsTerminalFocused.raw,
    });
  }

  registerNextMenus(menuRegistry: IMenuRegistry) {
    /** 终端 Tab 菜单 */
    menuRegistry.registerMenuItem(MenuId.TermTab, {
      command: {
        id: TERMINAL_COMMANDS.SPLIT.id,
        label: localize('terminal.menu.split'),
      },
      order: 1,
      group,
    });

    menuRegistry.registerMenuItem(MenuId.TermTab, {
      command: {
        id: TERMINAL_COMMANDS.TAB_RENAME.id,
        label: localize('terminal.menu.rename'),
      },
      order: 2,
      group,
    });

    menuRegistry.registerMenuItem(MenuId.TermTab, {
      command: {
        id: TERMINAL_COMMANDS.REMOVE.id,
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
      command: TERMINAL_COMMANDS.CLEAR_ALL_CONTENT,
      order: 1,
      group: more1,
      when,
    });

    menuRegistry.registerMenuItem(commonMenuId, {
      command: TERMINAL_COMMANDS.CLEAR,
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

    if (isElectronRenderer() && isWindows) {
      menuRegistry.registerMenuItems('tabbar_bottom_select_sub', [{
        command: TERMINAL_COMMANDS.SELECT_CMD,
        order: 1,
        group: more1Sub,
        toggledWhen: 'config.terminal.type == cmd',
        when,
      }, {
        command: TERMINAL_COMMANDS.SELECT_POWERSHELL,
        order: 2,
        group: more1Sub,
        toggledWhen: 'config.terminal.type == powershell',
        when,
      }]);
    } else {
      menuRegistry.registerMenuItems('tabbar_bottom_select_sub', [{
        command: TERMINAL_COMMANDS.SELECT_ZSH,
        order: 1,
        group: more1Sub,
        toggledWhen: 'config.terminal.type == zsh',
        when,
      }, {
        command: TERMINAL_COMMANDS.SELECT_BASH,
        order: 2,
        group: more1Sub,
        toggledWhen: 'config.terminal.type == bash',
        when,
      }, {
        command: TERMINAL_COMMANDS.SELECT_SH,
        order: 3,
        group: more1Sub,
        toggledWhen: 'config.terminal.type == sh',
        when,
      }]);
    }

    menuRegistry.registerMenuItem(commonMenuId, {
      command: TERMINAL_COMMANDS.MORE_SETTINGS,
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
