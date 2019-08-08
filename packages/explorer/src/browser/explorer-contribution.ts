import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, ClientAppContribution, EXPLORER_COMMANDS, URI, Domain, KeybindingContribution, KeybindingRegistry } from '@ali/ide-core-browser';
import { ExplorerResourceService } from './explorer-resource.service';
import { FileTreeService } from '@ali/ide-file-tree';
import { LayoutContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { Explorer } from './explorer.view';

@Domain(ClientAppContribution, CommandContribution, LayoutContribution, KeybindingContribution)
export class ExplorerContribution implements CommandContribution, LayoutContribution, KeybindingContribution {

  @Autowired()
  private explorerResourceService: ExplorerResourceService;

  @Autowired()
  private filetreeService: FileTreeService;

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(EXPLORER_COMMANDS.LOCATION, {
      execute: (uri?: URI) => {
        let locationUri = uri;
        if (!locationUri) {
          locationUri = this.filetreeService.getSelectedFileItem[0];
        }
        if (locationUri) {
          this.explorerResourceService.location(locationUri);
        }
      },
    });
  }

  registerKeybindings(bindings: KeybindingRegistry) {
    bindings.registerKeybinding({
      command: EXPLORER_COMMANDS.LOCATION.id,
      keybinding: 'cmd+shift+e',
    });
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-explorer', {
      component: Explorer,
      iconClass: 'volans_icon code_editor',
      weight: 10,
    });
  }

}
