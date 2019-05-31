import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command } from '@ali/ide-core-common/lib/command';
import { MainLayoutService } from './main-layout.service';
import { SlotLocation } from '../common/main-layout-slot';
import { Domain } from '@ali/ide-core-common';

export const HIDE_ACTIVATOR_PANEL_COMMAND: Command = {
  id: 'main-layout.activator-panel.hide',
};
export const SHOW_ACTIVATOR_PANEL_COMMAND: Command = {
  id: 'main-layout.activator-panel.show',
};
export const HIDE_SUBSIDIARY_PANEL_COMMAND: Command = {
  id: 'main-layout.subsidiary-panel.hide',
};
export const SHOW_SUBSIDIARY_PANEL_COMMAND: Command = {
  id: 'main-layout.subsidiary-panel.show',
};

export const SET_PANEL_SIZE_COMMAND: Command = {
  id: 'main-layout.panel.size.set',
};

@Injectable()
@Domain(CommandContribution)
export class MainLayoutContribution implements CommandContribution {

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
  }
}
