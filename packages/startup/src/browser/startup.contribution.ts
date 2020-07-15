import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, IEventBus } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger, ClientAppContribution, IToolbarRegistry, ToolBarActionContribution } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
// import { StatusBar, StatusBarAlignment } from '@ali/ide-status-bar/lib/browser/status-bar.service';
import { IStatusBarService} from '@ali/ide-core-browser/lib/services';
import { OutputService } from '@ali/ide-output/lib/browser/output.service';
import { BrowserEditorContribution, EditorComponentRegistry } from '@ali/ide-editor/lib/browser';
import { ExampleEditorBottomWidget } from './editor-bottom-example';

@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, ComponentContribution, ToolBarActionContribution, BrowserEditorContribution)
export class StartupContribution implements CommandContribution, KeybindingContribution, ClientAppContribution, ComponentContribution, ToolBarActionContribution, BrowserEditorContribution {

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

  registerEditorComponent(registry: EditorComponentRegistry) {
    registry.registerEditorSideWidget({
      id: 'example-bottom',
      component: ExampleEditorBottomWidget,
      displaysOnResource: (r) => {
        return r.uri.scheme === 'file';
      },
    });
  }

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
