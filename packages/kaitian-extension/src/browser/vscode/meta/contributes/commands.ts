import { VSCodeContributePoint, Contributes, ExtensionService } from '../../../../common';
import { Injectable, Autowired } from '@ali/common-di';
import { CommandRegistry, CommandService, ILogger, PreferenceService, localize, URI, isNonEmptyArray, replaceLocalizePlaceholder } from '@ali/ide-core-browser';
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
    const nlsRegx = /^%([\w\d.-]+)%$/i;
    const result = nlsRegx.exec(title);
    if (result) {
      return localize(result[1], undefined, this.extension.id);
    }
    return title;
  }

  async contribute() {
    this.json.forEach((command) => {
      this.addDispose(this.commandRegistry.registerCommand({
        category: this.getLocalieFromNlsJSON(command.category),
        label: this.getLocalieFromNlsJSON(command.title),
        id: command.command,
        iconClass: this.iconService.fromIcon(this.extension.path, command.icon),
      }));
    });
  }
}
