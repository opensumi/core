import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command } from '@ali/ide-core-common/src/command';
import { MainLayoutService } from './main-layout.service';
import { SlotLocation } from '../common/main-layout-slot';

export const HIDE_PANEL_COMMAND: Command = {
  id: 'main-layout.panel.hide',
};

@Injectable()
export class MainLayoutContribution implements CommandContribution {

  @Autowired()
  private mainLayoutService!: MainLayoutService;


  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(HIDE_PANEL_COMMAND, {
      execute: (slotName: SlotLocation) => {
        this.mainLayoutService.hidePanel(slotName);
      },
    });
  }
}
