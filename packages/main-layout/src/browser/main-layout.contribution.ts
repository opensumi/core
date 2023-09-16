import { Autowired } from '@opensumi/di';
import {
  IContextKeyService,
  ClientAppContribution,
  SlotLocation,
  SlotRendererContribution,
  SlotRendererRegistry,
  slotRendererRegistry,
  KeybindingRegistry,
  LAYOUT_COMMANDS,
  IQuickOpenHandlerRegistry,
  QuickOpenContribution,
  QUICK_OPEN_COMMANDS,
  EDITOR_COMMANDS,
} from '@opensumi/ide-core-browser';
import { getIcon } from '@opensumi/ide-core-browser';
import {
  DEBUG_CONSOLE_CONTAINER_ID,
  DEBUG_CONTAINER_ID,
  EXPLORER_CONTAINER_ID,
  EXTENSION_CONTAINER_ID,
  MARKER_CONTAINER_ID,
  OUTPUT_CONTAINER_ID,
  SCM_CONTAINER_ID,
  SEARCH_CONTAINER_ID,
  TERMINAL_CONTAINER_ID,
} from '@opensumi/ide-core-browser/lib/common/container-id';
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

import { ViewQuickOpenHandler } from './quick-open-view';
import { RightTabRenderer, LeftTabRenderer, BottomTabRenderer } from './tabbar/renderer.view';

// NOTE 左右侧面板的展开、折叠命令请使用组合命令 activity-bar.left.toggle，layout命令仅做折叠展开，不处理tab激活逻辑
export const HIDE_LEFT_PANEL_COMMAND: Command = {
  id: 'main-layout.left-panel.hide',
  label: '%main-layout.left-panel.hide%',
};

export const WORKBENCH_ACTION_CLOSESIDECAR: Command = {
  id: 'workbench.action.closeSidebar',
  label: '%main-layout.sidebar.hide%',
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

export const WORKBENCH_ACTION_CLOSEPANEL: Command = {
  id: 'workbench.action.closePanel',
  delegate: HIDE_BOTTOM_PANEL_COMMAND.id,
};

export const SHOW_BOTTOM_PANEL_COMMAND: Command = {
  id: 'main-layout.bottom-panel.show',
  label: '%main-layout.bottom-panel.show%',
};
export const TOGGLE_BOTTOM_PANEL_COMMAND: Command = {
  id: 'main-layout.bottom-panel.toggle',
  iconClass: getIcon('minus'),
  label: '%layout.tabbar.toggle%',
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
  label: '%layout.tabbar.expand%',
  iconClass: getIcon('expand'),
};
export const RETRACT_BOTTOM_PANEL: Command = {
  id: 'main-layout.bottom-panel.retract',
  label: '%layout.tabbar.retract%',
  iconClass: getIcon('shrink'),
};

@Domain(CommandContribution, ClientAppContribution, SlotRendererContribution, MenuContribution, QuickOpenContribution)
export class MainLayoutModuleContribution
  extends WithEventBus
  implements
    CommandContribution,
    ClientAppContribution,
    SlotRendererContribution,
    MenuContribution,
    QuickOpenContribution
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

  @Autowired(ViewQuickOpenHandler)
  private quickOpenViewHandler: ViewQuickOpenHandler;

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
    registry.registerSlotRenderer(SlotLocation.bottom, BottomTabRenderer);
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

    commands.registerCommand(WORKBENCH_ACTION_CLOSESIDECAR, {
      execute: () =>
        Promise.all([
          this.mainLayoutService.toggleSlot(SlotLocation.left, false),
          this.mainLayoutService.toggleSlot(SlotLocation.right, false),
        ]),
    });

    commands.registerCommand(SHOW_BOTTOM_PANEL_COMMAND, {
      execute: () => {
        this.mainLayoutService.toggleSlot(SlotLocation.bottom, true);
      },
    });

    commands.registerCommand(HIDE_BOTTOM_PANEL_COMMAND, {
      execute: () => {
        this.mainLayoutService.toggleSlot(SlotLocation.bottom, false);
      },
    });
    commands.registerCommand(WORKBENCH_ACTION_CLOSEPANEL);
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

    commands.registerCommand(
      {
        id: LAYOUT_COMMANDS.MAXIMIZE_EDITOR.id,
      },
      {
        execute: () => {
          this.commandService.executeCommand(TOGGLE_RIGHT_PANEL_COMMAND.id, false);
          this.commandService.executeCommand(TOGGLE_LEFT_PANEL_COMMAND.id, false);
        },
      },
    );

    commands.registerCommand(LAYOUT_COMMANDS.OPEN_VIEW, {
      execute: () => {
        this.commandService.executeCommand(QUICK_OPEN_COMMANDS.OPEN_VIEW.id);
      },
    });
  }

  registerMenus(menus: IMenuRegistry) {
    menus.registerMenuItem(MenuId.ActivityBarExtra, {
      submenu: MenuId.SettingsIconMenu,
      iconClass: getIcon('setting'),
      label: localize('layout.tabbar.setting'),
      order: 1,
      group: 'navigation',
    });

    Object.entries({
      [SlotLocation.left]: [
        EXPLORER_CONTAINER_ID,
        SEARCH_CONTAINER_ID,
        SCM_CONTAINER_ID,
        DEBUG_CONTAINER_ID,
        EXTENSION_CONTAINER_ID,
      ],
      [SlotLocation.bottom]: [
        MARKER_CONTAINER_ID,
        OUTPUT_CONTAINER_ID,
        DEBUG_CONSOLE_CONTAINER_ID,
        TERMINAL_CONTAINER_ID,
      ],
    }).forEach(([slotLocation, containerIds], index) => {
      const tabbarService = this.mainLayoutService.getTabbarService(slotLocation);

      tabbarService.viewReady.promise.then(() => {
        containerIds.forEach((id) => {
          /**
           * 这里先使用 getContainer 判断下这个 container id 在集成方上是否被挂载
           */
          const info = tabbarService.getContainer(id);
          if (info) {
            menus.registerMenuItem(MenuId.MenubarViewMenu, {
              command: {
                id: `container.toggle.${id}`,
                label: info.options?.title ?? id,
              },
              // 因为当前菜单已有菜单项，这里从 3 开始
              group: `${3 + index}_${slotLocation}`,
            });
          }
        });
      });
    });

    menus.registerMenuItem(MenuId.MenubarViewMenu, {
      command: TOGGLE_LEFT_PANEL_COMMAND,
      group: '5_panel',
    });
    menus.registerMenuItem(MenuId.MenubarViewMenu, {
      command: TOGGLE_RIGHT_PANEL_COMMAND,
      group: '5_panel',
    });
    menus.registerMenuItem(MenuId.MenubarViewMenu, {
      command: TOGGLE_BOTTOM_PANEL_COMMAND as MenuCommandDesc,
      group: '5_panel',
    });
    menus.registerMenuItem(MenuId.MenubarViewMenu, {
      command: EXPAND_BOTTOM_PANEL as MenuCommandDesc,
      group: '5_panel',
      when: '!bottomFullExpanded',
    });
    menus.registerMenuItem(MenuId.MenubarViewMenu, {
      command: RETRACT_BOTTOM_PANEL as MenuCommandDesc,
      group: '5_panel',
      when: 'bottomFullExpanded',
    });

    menus.registerMenuItem(MenuId.MenubarViewMenu, {
      command: {
        id: EDITOR_COMMANDS.TOGGLE_WORD_WRAP.id,
        label: '%preference.editor.wordWrap%',
      },
      group: '6_capability',
      toggledWhen: 'config.editor.wordWrap == on',
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
    this.keybindingRegistry.registerKeybinding({
      keybinding: 'ctrlcmd+shift+j',
      command: EXPAND_BOTTOM_PANEL.id,
      when: '!bottomFullExpanded',
    });
    this.keybindingRegistry.registerKeybinding({
      keybinding: 'ctrlcmd+shift+j',
      command: RETRACT_BOTTOM_PANEL.id,
      when: 'bottomFullExpanded',
    });
  }

  registerQuickOpenHandlers(handlers: IQuickOpenHandlerRegistry): void {
    handlers.registerHandler(this.quickOpenViewHandler, {
      title: localize('layout.action.openView'),
      commandId: LAYOUT_COMMANDS.QUICK_OPEN_VIEW.id,
      order: 5,
      hideTab: true,
    });
  }
}
