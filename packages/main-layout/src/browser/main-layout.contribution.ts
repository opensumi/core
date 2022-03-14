import { Autowired } from '@opensumi/di';
import {
  IContextKeyService,
  ClientAppContribution,
  SlotLocation,
  SlotRendererContribution,
  SlotRendererRegistry,
  slotRendererRegistry,
  KeybindingRegistry,
} from '@opensumi/ide-core-browser';
import { getIcon } from '@opensumi/ide-core-browser';
import {
  ComponentContribution,
  ComponentRegistry,
  TabBarToolbarContribution,
  ToolbarRegistry,
} from '@opensumi/ide-core-browser/lib/layout';
import { LayoutState } from '@opensumi/ide-core-browser/lib/layout/layout-state';
import {
  IMenuRegistry,
  MenuCommandDesc,
  MenuContribution as MenuContribution,
  MenuId,
} from '@opensumi/ide-core-browser/lib/menu/next';
import { Domain, IEventBus, ContributionProvider, localize, WithEventBus } from '@opensumi/ide-core-common';
import { CommandContribution, CommandRegistry, Command, CommandService } from '@opensumi/ide-core-common/lib/command';

import { IMainLayoutService } from '../common';


import { RightTabRenderer, LeftTabRenderer, NextBottomTabRenderer } from './tabbar/renderer.view';


// NOTE 左右侧面板的展开、折叠命令请使用组合命令 activity-bar.left.toggle，layout命令仅做折叠展开，不处理tab激活逻辑
export const HIDE_LEFT_PANEL_COMMAND: Command = {
  id: 'main-layout.left-panel.hide',
  label: '%main-layout.left-panel.hide%',
};
export const SHOW_LEFT_PANEL_COMMAND: Command = {
  id: 'main-layout.left-panel.show',
  label: '%main-layout.left-panel.show%',
};
export const TOGGLE_LEFT_PANEL_COMMAND: MenuCommandDesc = {
  id: 'main-layout.left-panel.toggle',
  label: '%main-layout.left-panel.toggle%',
};
export const HIDE_RIGHT_PANEL_COMMAND: Command = {
  id: 'main-layout.right-panel.hide',
  label: '%main-layout.right-panel.hide%',
};
export const SHOW_RIGHT_PANEL_COMMAND: Command = {
  id: 'main-layout.right-panel.show',
  label: '%main-layout.right-panel.show%',
};
export const TOGGLE_RIGHT_PANEL_COMMAND: MenuCommandDesc = {
  id: 'main-layout.right-panel.toggle',
  label: '%main-layout.right-panel.toggle%',
};

export const HIDE_BOTTOM_PANEL_COMMAND: Command = {
  id: 'main-layout.bottom-panel.hide',
  label: '%main-layout.bottom-panel.hide%',
};
export const SHOW_BOTTOM_PANEL_COMMAND: Command = {
  id: 'main-layout.bottom-panel.show',
  label: '%main-layout.bottom-panel.show%',
};
export const TOGGLE_BOTTOM_PANEL_COMMAND: Command = {
  id: 'main-layout.bottom-panel.toggle',
  iconClass: getIcon('minus'),
  label: localize('layout.tabbar.hide', '收起面板'),
};
export const IS_VISIBLE_BOTTOM_PANEL_COMMAND: Command = {
  id: 'main-layout.bottom-panel.is-visible',
};
export const IS_VISIBLE_LEFT_PANEL_COMMAND: Command = {
  id: 'main-layout.left-panel.is-visible',
};
export const IS_VISIBLE_RIGHT_PANEL_COMMAND: Command = {
  id: 'main-layout.right-panel.is-visible',
};
export const SET_PANEL_SIZE_COMMAND: Command = {
  id: 'main-layout.panel.size.set',
};
export const EXPAND_BOTTOM_PANEL: Command = {
  id: 'main-layout.bottom-panel.expand',
  label: localize('layout.tabbar.expand', '最大化面板'),
  iconClass: getIcon('expand'),
};
export const RETRACT_BOTTOM_PANEL: Command = {
  id: 'main-layout.bottom-panel.retract',
  label: localize('layout.tabbar.retract', '恢复面板'),
  iconClass: getIcon('shrink'),
};

@Domain(CommandContribution, ClientAppContribution, SlotRendererContribution, MenuContribution)
export class MainLayoutModuleContribution
  extends WithEventBus
  implements CommandContribution, ClientAppContribution, SlotRendererContribution, MenuContribution
{
  @Autowired(IMainLayoutService)
  private mainLayoutService: IMainLayoutService;

  @Autowired(IContextKeyService)
  contextKeyService: IContextKeyService;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired(ComponentContribution)
  contributionProvider: ContributionProvider<ComponentContribution>;

  @Autowired(SlotRendererContribution)
  rendererContributionProvider: ContributionProvider<SlotRendererContribution>;

  @Autowired(ComponentRegistry)
  componentRegistry: ComponentRegistry;

  @Autowired(CommandService)
  private commandService!: CommandService;

  @Autowired()
  private layoutState: LayoutState;

  @Autowired(TabBarToolbarContribution)
  protected readonly toolBarContributionProvider: ContributionProvider<TabBarToolbarContribution>;

  @Autowired()
  private toolBarRegistry: ToolbarRegistry;

  @Autowired(KeybindingRegistry)
  protected keybindingRegistry: KeybindingRegistry;

  async initialize() {
    // 全局只要初始化一次
    await this.layoutState.initStorage();

    const componentContributions = this.contributionProvider.getContributions();
    for (const contribution of componentContributions) {
      if (contribution.registerComponent) {
        contribution.registerComponent(this.componentRegistry);
      }
    }
    const rendererContributions = this.rendererContributionProvider.getContributions();
    for (const contribution of rendererContributions) {
      if (contribution.registerRenderer) {
        contribution.registerRenderer(slotRendererRegistry);
      }
    }
    const contributions = this.toolBarContributionProvider.getContributions();
    for (const contribution of contributions) {
      if (contribution.registerToolbarItems) {
        contribution.registerToolbarItems(this.toolBarRegistry);
      }
    }
  }

  async onStart() {
    this.registerSideToggleKey();
  }

  async onDidStart() {
    this.mainLayoutService.didMount();
  }

  registerRenderer(registry: SlotRendererRegistry) {
    registry.registerSlotRenderer(SlotLocation.right, RightTabRenderer);
    registry.registerSlotRenderer(SlotLocation.left, LeftTabRenderer);
    registry.registerSlotRenderer(SlotLocation.bottom, NextBottomTabRenderer);
  }

  registerCommands(commands: CommandRegistry): void {
    // @deprecated
    commands.registerCommand(HIDE_LEFT_PANEL_COMMAND, {
      execute: () => {
        this.mainLayoutService.toggleSlot(SlotLocation.left, false);
      },
    });
    // @deprecated
    commands.registerCommand(SHOW_LEFT_PANEL_COMMAND, {
      execute: (size?: number) => {
        this.mainLayoutService.toggleSlot(SlotLocation.left, true, size);
      },
    });
    commands.registerCommand(TOGGLE_LEFT_PANEL_COMMAND, {
      execute: (show?: boolean, size?: number) => {
        this.mainLayoutService.toggleSlot(SlotLocation.left, show, size);
      },
    });

    // @deprecated
    commands.registerCommand(HIDE_RIGHT_PANEL_COMMAND, {
      execute: () => {
        this.mainLayoutService.toggleSlot(SlotLocation.right, false);
      },
    });
    // @deprecated
    commands.registerCommand(SHOW_RIGHT_PANEL_COMMAND, {
      execute: (size?: number) => {
        this.mainLayoutService.toggleSlot(SlotLocation.right, true, size);
      },
    });
    commands.registerCommand(TOGGLE_RIGHT_PANEL_COMMAND, {
      execute: (show?: boolean, size?: number) => {
        this.mainLayoutService.toggleSlot(SlotLocation.right, show, size);
      },
    });

    // @deprecated
    commands.registerCommand(SHOW_BOTTOM_PANEL_COMMAND, {
      execute: () => {
        this.mainLayoutService.toggleSlot(SlotLocation.bottom, true);
      },
    });
    // @deprecated
    commands.registerCommand(HIDE_BOTTOM_PANEL_COMMAND, {
      execute: () => {
        this.mainLayoutService.toggleSlot(SlotLocation.bottom, false);
      },
    });
    commands.registerCommand(TOGGLE_BOTTOM_PANEL_COMMAND, {
      execute: (show?: boolean, size?: number) => {
        this.mainLayoutService.toggleSlot(SlotLocation.bottom, show, size);
      },
    });
    commands.registerCommand(IS_VISIBLE_BOTTOM_PANEL_COMMAND, {
      execute: () => this.mainLayoutService.getTabbarService('bottom').currentContainerId !== '',
    });
    commands.registerCommand(IS_VISIBLE_LEFT_PANEL_COMMAND, {
      execute: () => this.mainLayoutService.isVisible(SlotLocation.left),
    });
    commands.registerCommand(IS_VISIBLE_RIGHT_PANEL_COMMAND, {
      execute: () => this.mainLayoutService.isVisible(SlotLocation.left),
    });
    commands.registerCommand(SET_PANEL_SIZE_COMMAND, {
      execute: (size: number) => {
        this.mainLayoutService.setFloatSize(size);
      },
    });
    commands.registerCommand(EXPAND_BOTTOM_PANEL, {
      execute: () => {
        this.mainLayoutService.expandBottom(true);
      },
    });
    commands.registerCommand(RETRACT_BOTTOM_PANEL, {
      execute: () => {
        this.mainLayoutService.expandBottom(false);
      },
    });

    commands.registerCommand(
      {
        id: 'view.outward.right-panel.hide',
      },
      {
        execute: () => {
          this.commandService.executeCommand('main-layout.right-panel.toggle', false);
        },
      },
    );
    commands.registerCommand(
      {
        id: 'view.outward.right-panel.show',
      },
      {
        execute: (size?: number) => {
          this.commandService.executeCommand('main-layout.right-panel.toggle', true, size);
        },
      },
    );
    commands.registerCommand(
      {
        id: 'view.outward.left-panel.hide',
      },
      {
        execute: () => {
          this.commandService.executeCommand('main-layout.left-panel.toggle', false);
        },
      },
    );
    commands.registerCommand(
      {
        id: 'view.outward.left-panel.show',
      },
      {
        execute: (size?: number) => {
          this.commandService.executeCommand('main-layout.left-panel.toggle', true, size);
        },
      },
    );
  }

  registerMenus(menus: IMenuRegistry) {
    menus.registerMenuItem(MenuId.ActivityBarExtra, {
      submenu: MenuId.SettingsIconMenu,
      iconClass: getIcon('setting'),
      label: localize('layout.tabbar.setting', '打开偏好设置'),
      order: 1,
      group: 'navigation',
    });

    menus.registerMenuItem(MenuId.MenubarViewMenu, {
      command: TOGGLE_LEFT_PANEL_COMMAND,
      group: '5_panel',
    });

    menus.registerMenuItem(MenuId.MenubarViewMenu, {
      command: TOGGLE_RIGHT_PANEL_COMMAND,
      group: '5_panel',
    });
  }

  protected registerSideToggleKey() {
    this.keybindingRegistry.registerKeybinding({
      keybinding: 'ctrlcmd+b',
      command: TOGGLE_LEFT_PANEL_COMMAND.id,
    });
    this.keybindingRegistry.registerKeybinding({
      keybinding: 'ctrlcmd+j',
      command: TOGGLE_BOTTOM_PANEL_COMMAND.id,
    });
  }
}
