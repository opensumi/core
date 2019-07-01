import { VscodeContributionPoint, replaceLocalizePlaceholder } from './common';
import { Injectable, Autowired } from '@ali/common-di';
import { CommandRegistry, getLogger } from '@ali/ide-core-browser';

export interface CommandFormat {

  command: string;

  title: string;

  category: string;

}

export type CommandsSchema = Array<CommandFormat>;

@Injectable({multiple: true})
export class CommandsContributionPoint extends VscodeContributionPoint<CommandsSchema> {

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  contribute() {
    this.json.forEach((command) => {
      this.addDispose(this.commandRegistry.registerCommand({
        category: command.category,
        label: replaceLocalizePlaceholder(command.title),
        id: command.command,
      }, {
        execute: () => {
          getLogger().log(command.command);
        },
      }));
    });
  }

}
