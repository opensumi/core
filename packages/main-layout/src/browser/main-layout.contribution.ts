import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command, CommandService } from '@ali/ide-core-common/lib/command';
import { Domain, IEventBus, ContributionProvider } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, IContextKeyService, ClientAppContribution, SlotLocation } from '@ali/ide-core-browser';
import { IMainLayoutService, MainLayoutContribution } from '../common';
import { ComponentContribution, ComponentRegistry, VisibleChangedEvent } from '@ali/ide-core-browser/lib/layout';
import { LayoutState } from '@ali/ide-core-browser/lib/layout/layout-state';

// NOTE 左右侧面板的展开、折叠命令请使用组合命令 activity-bar.left.toggle，layout命令仅做折叠展开，不处理tab激活逻辑
export const HIDE_LEFT_PANEL_COMMAND: Command = {
  id: 'main-layout.left-panel.hide',
};
export const SHOW_LEFT_PANEL_COMMAND: Command = {
  id: 'main-layout.left-panel.show',
};
export const TOGGLE_LEFT_PANEL_COMMAND: Command = {
  id: 'main-layout.left-panel.toggle',
};
export const HIDE_RIGHT_PANEL_COMMAND: Command = {
  id: 'main-layout.right-panel.hide',
};
export const SHOW_RIGHT_PANEL_COMMAND: Command = {
  id: 'main-layout.right-panel.show',
};
export const TOGGLE_RIGHT_PANEL_COMMAND: Command = {
  id: 'main-layout.right-panel.toggle',
};

export const HIDE_BOTTOM_PANEL_COMMAND: Command = {
  id: 'main-layout.bottom-panel.hide',
};
export const SHOW_BOTTOM_PANEL_COMMAND: Command = {
  id: 'main-layout.bottom-panel.show',
};
export const TOGGLE_BOTTOM_PANEL_COMMAND: Command = {
  id: 'main-layout.bottom-panel.toggle',
};
export const SET_PANEL_SIZE_COMMAND: Command = {
  id: 'main-layout.panel.size.set',
};

@Domain(CommandContribution, ClientAppContribution)
export class MainLayoutModuleContribution implements CommandContribution, ClientAppContribution {

  @Autowired(IMainLayoutService)
  private mainLayoutService: IMainLayoutService;

  @Autowired(IContextKeyService)
  contextKeyService: IContextKeyService;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired(ComponentContribution)
  contributionProvider: ContributionProvider<ComponentContribution>;

  @Autowired(ComponentRegistry)
  componentRegistry: ComponentRegistry;

  @Autowired(CommandService)
  private commandService!: CommandService;

  @Autowired()
  private layoutState: LayoutState;

  async onStart() {
    const componentContributions = this.contributionProvider.getContributions();
    for (const contribution of componentContributions) {
      contribution.registerComponent(this.componentRegistry);
    }
    // 全局只要初始化一次
    await this.layoutState.initStorage();
    await this.mainLayoutService.restoreState();

    const rightPanelVisible = this.contextKeyService.createKey<boolean>('rightPanelVisible', false);
    const updateRightPanelVisible = () => {
      rightPanelVisible.set(this.mainLayoutService.isVisible(SlotLocation.right));
    };
    this.eventBus.on(VisibleChangedEvent, (event: VisibleChangedEvent) => {
      updateRightPanelVisible();
    });

    const leftPanelVisible = this.contextKeyService.createKey<boolean>('leftPanelVisible', false);
    const updateLeftPanelVisible = () => {
      leftPanelVisible.set(this.mainLayoutService.isVisible(SlotLocation.left));
    };
    this.eventBus.on(VisibleChangedEvent, (event: VisibleChangedEvent) => {
      updateLeftPanelVisible();
    });
    const bottomPanelVisible = this.contextKeyService.createKey<boolean>('bottomPanelVisible', false);
    this.eventBus.on(VisibleChangedEvent, (event: VisibleChangedEvent) => {
      bottomPanelVisible.set(this.mainLayoutService.isVisible(SlotLocation.bottom));
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(HIDE_LEFT_PANEL_COMMAND, {
      execute: () => {
        this.mainLayoutService.toggleSlot(SlotLocation.left, false);
      },
    });
    commands.registerCommand(SHOW_LEFT_PANEL_COMMAND, {
      execute: (size?: number) => {
        this.mainLayoutService.toggleSlot(SlotLocation.left, true, size);
      },
    });
    commands.registerCommand(TOGGLE_LEFT_PANEL_COMMAND, {
      execute: () => {
        this.mainLayoutService.toggleSlot(SlotLocation.left);
      },
    });

    commands.registerCommand(HIDE_RIGHT_PANEL_COMMAND, {
      execute: () => {
        this.mainLayoutService.toggleSlot(SlotLocation.right, false);
      },
    });
    commands.registerCommand(SHOW_RIGHT_PANEL_COMMAND, {
      execute: (size?: number) => {
        this.mainLayoutService.toggleSlot(SlotLocation.right, true, size);
      },
    });
    commands.registerCommand(TOGGLE_RIGHT_PANEL_COMMAND, {
      execute: () => {
        this.mainLayoutService.toggleSlot(SlotLocation.right);
      },
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
    commands.registerCommand(TOGGLE_BOTTOM_PANEL_COMMAND, {
      execute: () => {
        this.mainLayoutService.toggleSlot(SlotLocation.bottom);
      },
    });
  }
}
