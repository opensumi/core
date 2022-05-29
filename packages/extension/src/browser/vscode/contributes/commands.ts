import { Injectable, Autowired } from '@opensumi/di';
import { CommandRegistry, AppConfig } from '@opensumi/ide-core-browser';
import { ThemeType, IIconService, IconType } from '@opensumi/ide-theme';

import { VSCodeContributePoint, Contributes, ExtensionService, IExtCommandManagement } from '../../../common';

export interface CommandFormat {
  /**
   * Identifier of the command to execute
   */
  command: string;
  /**
   * Title by which the command is represented in the UI
   */
  title: string;
  /**
   * Short title by which the command is represented in the UI.
   * Menus pick either `title` or `shortTitle` depending on the context in which they show commands.
   */
  shortTitle?: string;
  /**
   * Category string by which the command is grouped in the UI
   */
  category: string;

  icon: { [index in ThemeType]: string } | string;
  /**
   * Condition which must be true to enable the command in the UI (menu and keybindings).
   * Does not prevent executing the command by other means, like the `executeCommand`-api.
   */
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
  protected readonly iconService: IIconService;

  @Autowired(AppConfig)
  private readonly config: AppConfig;

  async contribute() {
    this.json.forEach((command) => {
      this.addDispose(
        this.commandRegistry.registerCommand(
          {
            category: this.getLocalizeFromNlsJSON(command.category),
            label: this.getLocalizeFromNlsJSON(command.title),
            shortLabel: command.shortTitle ? this.getLocalizeFromNlsJSON(command.shortTitle) : undefined,
            id: command.command,
            iconClass:
              (typeof command.icon === 'string' && this.iconService.fromString(command.icon)) ||
              this.iconService.fromIcon(this.extension.path, command.icon, IconType.Background),
            enablement: command.enablement,
            alias: this.getLocalizeFromNlsJSON(command.title, command.command),
            aliasCategory: this.getLocalizeFromNlsJSON(command.category, command.command),
          },
          {
            execute: (...args: any[]) => this.extensionService.executeExtensionCommand(command.command, args),
          },
        ),
      );
      if (this.config.noExtHost) {
        this.addDispose(this.extensionCommandManager.registerExtensionCommandEnv(command.command, 'worker'));
      } else {
        this.addDispose(this.extensionCommandManager.registerExtensionCommandEnv(command.command, 'node'));
      }
    });
  }
}
