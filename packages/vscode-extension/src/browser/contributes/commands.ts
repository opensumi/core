import { VscodeContributionPoint, replaceLocalizePlaceholder, Contributes } from './common';
import { Injectable, Autowired } from '@ali/common-di';
import { CommandRegistry, getLogger, CommandService } from '@ali/ide-core-browser';
import { ExtHostAPIIdentifier } from '../../common';
import { VSCodeExtensionService } from '../types';

export interface CommandFormat {

  command: string;

  title: string;

  category: string;

}

export type CommandsSchema = Array<CommandFormat>;

@Injectable()
@Contributes('commands')
export class CommandsContributionPoint extends VscodeContributionPoint<CommandsSchema> {

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(VSCodeExtensionService)
  vscodeExtensionService: VSCodeExtensionService;

  contribute() {
    this.json.forEach((command) => {
      this.addDispose(this.commandRegistry.registerCommand({
        category: command.category,
        label: replaceLocalizePlaceholder(command.title),
        id: command.command,
      }, {
        execute: async () => {
          getLogger().log(command.command);
          const proxy = await this.vscodeExtensionService.getProxy(ExtHostAPIIdentifier.ExtHostCommands);
          return proxy.$executeContributedCommand(command.command);
        },
      }));
    });
  }

}
