import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command } from '@ali/ide-core-common/lib/command';
import { MainLayoutService } from './main-layout.service';
import { SlotLocation } from '../common/main-layout-slot';
import { Domain } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry } from '@ali/ide-core-browser';

export const HIDE_ACTIVATOR_PANEL_COMMAND: Command = {
  id: 'main-layout.activator-panel.hide',
};
export const SHOW_ACTIVATOR_PANEL_COMMAND: Command = {
  id: 'main-layout.activator-panel.show',
};
export const TOGGLE_ACTIVATOR_PANEL_COMMAND: Command = {
  id: 'main-layout.activator-panel.toggle',
};
export const HIDE_SUBSIDIARY_PANEL_COMMAND: Command = {
  id: 'main-layout.subsidiary-panel.hide',
};
export const SHOW_SUBSIDIARY_PANEL_COMMAND: Command = {
  id: 'main-layout.subsidiary-panel.show',
};
export const TOGGLE_SUBSIDIARY_PANEL_COMMAND: Command = {
  id: 'main-layout.subsidiary-panel.toggle',
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

@Domain(CommandContribution, KeybindingContribution)
export class MainLayoutContribution implements CommandContribution, KeybindingContribution {

  @Autowired()
  private mainLayoutService!: MainLayoutService;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(HIDE_ACTIVATOR_PANEL_COMMAND, {
      execute: () => {
        this.mainLayoutService.hideActivatorPanel();
      },
    });
    commands.registerCommand(SHOW_ACTIVATOR_PANEL_COMMAND, {
      execute: () => {
        this.mainLayoutService.showActivatorPanel();
      },
    });
    commands.registerCommand(HIDE_SUBSIDIARY_PANEL_COMMAND, {
      execute: () => {
        this.mainLayoutService.hideSubsidiaryPanel();
      },
    });
    commands.registerCommand(SHOW_SUBSIDIARY_PANEL_COMMAND, {
      execute: () => {
        this.mainLayoutService.showSubsidiaryPanel();
      },
    });
    commands.registerCommand(TOGGLE_SUBSIDIARY_PANEL_COMMAND, {
      execute: () => {
        this.mainLayoutService.toggleSubsidiaryPanel();
      },
    });
    commands.registerCommand(TOGGLE_ACTIVATOR_PANEL_COMMAND, {
      execute: () => {
        this.mainLayoutService.toggleActivatorPanel();
      },
    });

    commands.registerCommand(SHOW_BOTTOM_PANEL_COMMAND, {
      execute: () => {
        this.mainLayoutService.showBottomPanel();
      },
    });
    commands.registerCommand(HIDE_BOTTOM_PANEL_COMMAND, {
      execute: () => {
        this.mainLayoutService.hideBottomPanel();
      },
    });
    commands.registerCommand(TOGGLE_BOTTOM_PANEL_COMMAND, {
      execute: () => {
        this.mainLayoutService.toggleBottomPanel();
      },
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: TOGGLE_SUBSIDIARY_PANEL_COMMAND.id,
      keybinding: 'ctrlcmd+shift+r',
    });
    keybindings.registerKeybinding({
      command: TOGGLE_ACTIVATOR_PANEL_COMMAND.id,
      keybinding: 'ctrlcmd+shift+l',
    });
  }
}
