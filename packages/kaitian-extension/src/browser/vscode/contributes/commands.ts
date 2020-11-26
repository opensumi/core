import { VSCodeContributePoint, Contributes, ExtensionService } from '../../../common';
import { Injectable, Autowired } from '@ali/common-di';
import { CommandRegistry, CommandService, ILogger, PreferenceService, AppConfig } from '@ali/ide-core-browser';
import { ThemeType, IIconService, IconType } from '@ali/ide-theme';

export interface CommandFormat {

  command: string;

  title: string;

  category: string;

  icon: { [index in ThemeType]: string } | string;

  enablement?: string;

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

  @Autowired(AppConfig)
  config: AppConfig;

  async contribute() {
    this.json.forEach((command) => {
      this.addDispose(this.commandRegistry.registerCommand({
        category: this.getLocalizeFromNlsJSON(command.category),
        label: this.getLocalizeFromNlsJSON(command.title),
        id: command.command,
        iconClass: (typeof command.icon === 'string' && this.iconService.fromString(command.icon)) || this.iconService.fromIcon(this.extension.path, command.icon, IconType.Background),
        enablement: command.enablement,
      }, {
        execute: (...args: any[]) => {
          return this.extensionService.executeExtensionCommand(command.command, args);
        },
      }));
      // TODO: 支持定义worker中的command
      if (this.config.noExtHost) {
        this.addDispose(this.extensionService.declareExtensionCommand(command.command, 'worker'));
      } else {
        this.addDispose(this.extensionService.declareExtensionCommand(command.command, 'node'));
        // this.addDispose(this.extensionService.declareExtensionCommand(command.command, 'worker'));
      }
    });
  }
}
