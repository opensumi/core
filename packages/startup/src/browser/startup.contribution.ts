import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, IEventBus } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger, ClientAppContribution, IToolbarRegistry, ToolBarActionContribution } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
// import { StatusBar, StatusBarAlignment } from '@ali/ide-status-bar/lib/browser/status-bar.service';
import { IStatusBarService} from '@ali/ide-core-browser/lib/services';
import { OutputService } from '@ali/ide-output/lib/browser/output.service';

@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, ComponentContribution, ToolBarActionContribution)
export class StartupContribution implements CommandContribution, KeybindingContribution, ClientAppContribution, ComponentContribution, ToolBarActionContribution {

  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired(IStatusBarService)
  statusBar: IStatusBarService;

  @Autowired(OutputService)
  outputService: OutputService;

  @Autowired()
  logger: Logger;

  @Autowired(IToolbarRegistry)
  toolbarRegistry: IToolbarRegistry;

  onStart() {

  }

  registerComponent(registry: ComponentRegistry) {
  }

  registerCommands(commands: CommandRegistry): void {
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
  }

  registerToolbarActions(registry: IToolbarRegistry) {

  }
}
