import { VSCodeContributePoint, Contributes, ExtensionService, IExtCommandManagement } from '../../../common';
import { Injectable, Autowired } from '@ide-framework/common-di';
import { CommandRegistry, AppConfig } from '@ide-framework/ide-core-browser';
import { ThemeType, IIconService, IconType } from '@ide-framework/ide-theme';

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
  private readonly commandRegistry: CommandRegistry;

  @Autowired(ExtensionService)
  private readonly extensionService: ExtensionService;

  @Autowired(IExtCommandManagement)
  private readonly extensionCommandManager: IExtCommandManagement;

  @Autowired(IIconService)
  private readonly iconService: IIconService;

  @Autowired(AppConfig)
  private readonly config: AppConfig;

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
      if (this.config.noExtHost) {
        this.addDispose(this.extensionCommandManager.registerExtensionCommandEnv(command.command, 'worker'));
      } else {
        this.addDispose(this.extensionCommandManager.registerExtensionCommandEnv(command.command, 'node'));
      }
    });
  }
}
