import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command } from '@ali/ide-core-common/lib/command';
import { SlotLocation } from '../common/main-layout-slot';
import { Domain, IEventBus, ContributionProvider } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, IContextKeyService, ClientAppContribution } from '@ali/ide-core-browser';
import { MainLayoutService } from './main-layout.service';
import { VisibleChangedEvent } from '../common';
import { LayoutContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';

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

@Domain(CommandContribution, KeybindingContribution, ClientAppContribution)
export class MainLayoutContribution implements CommandContribution, KeybindingContribution, ClientAppContribution {

  @Autowired()
  private mainLayoutService!: MainLayoutService;

  @Autowired(IContextKeyService)
  contextKeyService: IContextKeyService;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired(LayoutContribution)
  contributionProvider: ContributionProvider<LayoutContribution>;

  @Autowired(ComponentRegistry)
  componentRegistry: ComponentRegistry;

  onStart() {
    const layoutContributions = this.contributionProvider.getContributions();
    for (const contribution of layoutContributions) {
      contribution.registerComponent(this.componentRegistry);
    }

    const rightPanelVisible = this.contextKeyService.createKey<boolean>('rightPanelVisible', false);
    const updateRightPanelVisible = () => {
      rightPanelVisible.set(this.mainLayoutService.isVisible(SlotLocation.right));
    };

    this.eventBus.on(VisibleChangedEvent, (event: VisibleChangedEvent) => {
      updateRightPanelVisible();
    });

  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(HIDE_LEFT_PANEL_COMMAND, {
      execute: () => {
        this.mainLayoutService.toggleSlot(SlotLocation.left, false);
      },
    });
    commands.registerCommand(SHOW_LEFT_PANEL_COMMAND, {
      execute: () => {
        this.mainLayoutService.toggleSlot(SlotLocation.left, true);
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
      execute: () => {
        this.mainLayoutService.toggleSlot(SlotLocation.right, true);
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

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: TOGGLE_RIGHT_PANEL_COMMAND.id,
      keybinding: 'ctrlcmd+k shift+r',
    });
    keybindings.registerKeybinding({
      command: TOGGLE_LEFT_PANEL_COMMAND.id,
      keybinding: 'ctrlcmd+shift+l',
    });
  }
}
