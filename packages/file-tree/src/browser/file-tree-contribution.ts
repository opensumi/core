import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';

export const CONSOLE_COMMAND: Command = {
  id: 'file.tree.console',
};

@Injectable()
@Domain(CommandContribution)
export class FileTreeCommandContribution implements CommandContribution {
  @Autowired()
  logger: Logger;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(CONSOLE_COMMAND, {
      execute: () => {
        // tslint:disable-next-line
        this.logger.log('file tree console..');
      },
    });
  }
}

@Injectable()
@Domain(KeybindingContribution)
export class FileTreeKeybindingContribution implements KeybindingContribution {
  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: CONSOLE_COMMAND.id,
      keybinding: 'ctrlcmd+f1',
    });
  }
}
