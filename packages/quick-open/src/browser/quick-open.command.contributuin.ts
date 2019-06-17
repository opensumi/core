import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command, Domain } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry } from '@ali/ide-core-browser';
import { QuickCommandService } from './quick-open.command.service';

export const quickCommand: Command = {
  id: 'quickCommand',
};

@Domain(CommandContribution, KeybindingContribution)
export class QuickOpenCommandContribution implements CommandContribution, KeybindingContribution {

  @Autowired()
  protected readonly quickCommandService: QuickCommandService;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(quickCommand, {
      execute: () => this.quickCommandService.open(),
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: quickCommand.id,
      keybinding: 'ctrlcmd+shift+p',
    });
  }
}
