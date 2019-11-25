import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, CommandService, IEventBus, formatLocalize, getLanguageId } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger, ClientAppContribution } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
// import { StatusBar, StatusBarAlignment } from '@ali/ide-status-bar/lib/browser/status-bar.service';
import { StatusBarAlignment, IStatusBarService} from '@ali/ide-core-browser/lib/services';
import { OutputService } from '@ali/ide-output/lib/browser/output.service';

@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, MenuContribution, ComponentContribution)
export class StartupContribution implements CommandContribution, KeybindingContribution, MenuContribution, ClientAppContribution, ComponentContribution {

  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired(CommandService)
  private commandService!: CommandService;

  @Autowired(IStatusBarService)
  statusBar: IStatusBarService;

  @Autowired(OutputService)
  outputService: OutputService;

  @Autowired()
  logger: Logger;

  onStart() {
  }

  registerComponent(registry: ComponentRegistry) {
  }

  registerCommands(commands: CommandRegistry): void {
  }

  registerMenus(menus: MenuModelRegistry): void {
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
  }
}
