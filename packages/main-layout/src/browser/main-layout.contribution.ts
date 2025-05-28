import { Autowired } from '@opensumi/di';
import {
  ClientAppContribution,
  EDITOR_COMMANDS,
  IContextKeyService,
  IQuickOpenHandlerRegistry,
  KeybindingRegistry,
  LAYOUT_COMMANDS,
  QUICK_OPEN_COMMANDS,
  QuickOpenContribution,
  SlotLocation,
  SlotRendererContribution,
  SlotRendererRegistry,
  getIcon,
  slotRendererRegistry,
} from '@opensumi/ide-core-browser';
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
import { ContributionProvider, Domain, IEventBus, WithEventBus, localize } from '@opensumi/ide-core-common';
import { CommandContribution, CommandRegistry, CommandService } from '@opensumi/ide-core-common/lib/command';

import { DROP_BOTTOM_CONTAINER, DROP_RIGHT_CONTAINER, IMainLayoutService } from '../common';

import {
  EXPAND_BOTTOM_PANEL,
  EXPAND_PANEL_COMMAND,
  IS_VISIBLE_BOTTOM_PANEL_COMMAND,
  IS_VISIBLE_EXTEND_VIEW_COMMAND,
  IS_VISIBLE_LEFT_PANEL_COMMAND,
  IS_VISIBLE_PANEL_COMMAND,
  IS_VISIBLE_RIGHT_PANEL_COMMAND,
  IS_VISIBLE_VIEW_COMMAND,
  RETRACT_BOTTOM_PANEL,
  RETRACT_PANEL_COMMAND,
  TOGGLE_BOTTOM_PANEL_COMMAND,
  TOGGLE_EXTEND_VIEW_COMMAND,
  TOGGLE_LEFT_PANEL_COMMAND,
  TOGGLE_PANEL_COMMAND,
  TOGGLE_RIGHT_PANEL_COMMAND,
  TOGGLE_VIEW_COMMAND,
  WORKBENCH_ACTION_CLOSEPANEL,
  WORKBENCH_ACTION_CLOSESIDECAR,
} from './command';
import { BottomDropArea, RightDropArea } from './drop-area/drop-area';
import { ViewQuickOpenHandler } from './quick-open-view';
import { BottomTabRenderer, LeftTabRenderer, RightTabRenderer } from './tabbar/renderer.view';

@Domain(
  CommandContribution,
  ClientAppContribution,
  SlotRendererContribution,
  MenuContribution,
  QuickOpenContribution,
  ComponentContribution,
)
export class MainLayoutModuleContribution
  extends WithEventBus
  implements
    CommandContribution,
    ClientAppContribution,
    SlotRendererContribution,
    MenuContribution,
    ComponentContribution,
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

  registerComponent(registry: ComponentRegistry): void {
    registry.register(DROP_RIGHT_CONTAINER, [], {
      component: RightDropArea,
      hideTab: true,
      containerId: DROP_RIGHT_CONTAINER,
    });
    registry.register(DROP_BOTTOM_CONTAINER, [], {
      component: BottomDropArea,
      hideTab: true,
      containerId: DROP_BOTTOM_CONTAINER,
    });
  }

  async onStart() {
    this.registerSideToggleKey();
  }

  async onDidStart() {
    this.mainLayoutService.didMount();
  }

  registerRenderer(registry: SlotRendererRegistry) {
    registry.registerSlotRenderer(SlotLocation.extendView, RightTabRenderer, {
      isLatter: true,
      supportedActions: {
        accordion: true,
      },
    });
    registry.registerSlotRenderer(SlotLocation.view, LeftTabRenderer, {
      supportedActions: {
        accordion: true,
      },
    });
    registry.registerSlotRenderer(SlotLocation.panel, BottomTabRenderer, {
      isLatter: true,
      supportedActions: {
        expand: true,
        toggle: true,
      },
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(TOGGLE_VIEW_COMMAND, {
      execute: (show?: boolean, size?: number) => {
        this.mainLayoutService.toggleSlot(SlotLocation.view, show, size);
      },
    });
    commands.registerCommand(TOGGLE_EXTEND_VIEW_COMMAND, {
      execute: (show?: boolean, size?: number) => {
        this.mainLayoutService.toggleSlot(SlotLocation.extendView, show, size);
      },
    });
    commands.registerCommand(TOGGLE_PANEL_COMMAND, {
      execute: (show?: boolean, size?: number) => {
        this.mainLayoutService.toggleSlot(SlotLocation.panel, show, size);
      },
    });
    commands.registerCommand(IS_VISIBLE_VIEW_COMMAND, {
      execute: () => this.mainLayoutService.isVisible(SlotLocation.view),
    });
    commands.registerCommand(IS_VISIBLE_EXTEND_VIEW_COMMAND, {
      execute: () => this.mainLayoutService.isVisible(SlotLocation.extendView),
    });
    commands.registerCommand(IS_VISIBLE_PANEL_COMMAND, {
      execute: () => this.mainLayoutService.isVisible(SlotLocation.panel),
    });
    // TODO: 下个版本废弃掉
    commands.registerCommand(TOGGLE_LEFT_PANEL_COMMAND);
    commands.registerCommand(TOGGLE_RIGHT_PANEL_COMMAND);
    commands.registerCommand(TOGGLE_BOTTOM_PANEL_COMMAND);
    commands.registerCommand(EXPAND_BOTTOM_PANEL);
    commands.registerCommand(RETRACT_BOTTOM_PANEL);
    commands.registerCommand(IS_VISIBLE_LEFT_PANEL_COMMAND);
    commands.registerCommand(IS_VISIBLE_RIGHT_PANEL_COMMAND);
    commands.registerCommand(IS_VISIBLE_BOTTOM_PANEL_COMMAND);

    commands.registerCommand(WORKBENCH_ACTION_CLOSESIDECAR, {
      execute: () =>
        Promise.all([
          this.mainLayoutService.toggleSlot(SlotLocation.view, false),
          this.mainLayoutService.toggleSlot(SlotLocation.extendView, false),
        ]),
    });

    commands.registerCommand(WORKBENCH_ACTION_CLOSEPANEL, {
      execute: () => {
        this.mainLayoutService.toggleSlot(SlotLocation.panel, false);
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
      [SlotLocation.view]: [
        EXPLORER_CONTAINER_ID,
        SEARCH_CONTAINER_ID,
        SCM_CONTAINER_ID,
        DEBUG_CONTAINER_ID,
        EXTENSION_CONTAINER_ID,
      ],
      [SlotLocation.panel]: [
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
      command: TOGGLE_VIEW_COMMAND,
      group: '5_panel',
    });
    menus.registerMenuItem(MenuId.MenubarViewMenu, {
      command: TOGGLE_EXTEND_VIEW_COMMAND,
      group: '5_panel',
    });
    menus.registerMenuItem(MenuId.MenubarViewMenu, {
      command: TOGGLE_PANEL_COMMAND as MenuCommandDesc,
      group: '5_panel',
    });

    menus.registerMenuItem(MenuId.MenubarViewMenu, {
      command: EXPAND_PANEL_COMMAND as MenuCommandDesc,
      group: '5_panel',
      when: '!bottomFullExpanded',
    });
    menus.registerMenuItem(MenuId.MenubarViewMenu, {
      command: RETRACT_PANEL_COMMAND as MenuCommandDesc,
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
      command: TOGGLE_VIEW_COMMAND.id,
    });
    this.keybindingRegistry.registerKeybinding({
      keybinding: 'ctrlcmd+j',
      command: TOGGLE_PANEL_COMMAND.id,
    });
    this.keybindingRegistry.registerKeybinding({
      keybinding: 'ctrlcmd+shift+j',
      command: EXPAND_PANEL_COMMAND.id,
      when: '!bottomFullExpanded',
    });
    this.keybindingRegistry.registerKeybinding({
      keybinding: 'ctrlcmd+shift+j',
      command: RETRACT_PANEL_COMMAND.id,
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
