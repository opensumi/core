import { VSCodeContributePoint, Contributes, ExtensionService } from '../../../../common';
import { Injectable, Autowired } from '@ali/common-di';
import { CommandRegistry, CommandService, ILogger, PreferenceService } from '@ali/ide-core-browser';
import { ExtHostAPIIdentifier } from '../../../../common/vscode';
import { ThemeType, IIconService } from '@ali/ide-theme';

export interface CommandFormat {

  command: string;

  title: string;

  category: string;

  icon: { [index in ThemeType]: string } | string;

}

export type CommandsSchema = Array<CommandFormat>;

@Injectable()
@Contributes('commands')
export class CommandsContributionPoint extends VSCodeContributePoint<CommandsSchema> {

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(ExtensionService)
  extensionService: ExtensionService;

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

  @Autowired(IIconService)
  iconService: IIconService;

  @Autowired(ILogger)
  logger: ILogger;

  private getLocalieFromNlsJSON(title: string) {
    if (!this.packageNlsJSON || this.preferenceService.get('general.language') !== 'en-US') {
      return title;
    }
    const nlsRegx = /^%([\w\d.-]+)%$/i;
    const result = nlsRegx.exec(title);
    return result ? this.packageNlsJSON[result[1]] : title;
  }

  contribute() {
    this.json.forEach((command) => {
      this.addDispose(this.commandRegistry.registerCommand({
        category: command.category,
        label: this.getLocalieFromNlsJSON(command.title),
        id: command.command,
        iconClass: this.iconService.fromIcon(this.extension.path, command.icon),
      }, {
        execute: async (...args) => {
          this.logger.log(command.command);
          // 获取扩展的 command 实例
          const proxy = await this.extensionService.getProxy(ExtHostAPIIdentifier.ExtHostCommands);
          // 实际执行的为在扩展进展中注册的处理函数
          return proxy.$executeContributedCommand(command.command, ...args);
        },
      }));
    });
  }

}
