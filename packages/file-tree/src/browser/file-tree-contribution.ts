import { Injectable } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command } from '@ali/ide-core-common/lib/command';

export const CONSOLE_COMMAND: Command = {
  id: 'file.tree.console',
};

@Injectable()
export class FileTreeContribution implements CommandContribution {
  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(CONSOLE_COMMAND, {
      execute: () => {
        // tslint:disable-next-line
        console.log('file tree console..');
      },
    });
  }
}
