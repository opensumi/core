import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, ClientAppContribution, EXPLORER_COMMANDS, URI, Domain } from '@ali/ide-core-browser';
import { ExplorerResourceService } from './explorer-resource.service';
import { FileTreeService } from '@ali/ide-file-tree';

@Domain(ClientAppContribution, CommandContribution)
export class ExplorerContribution implements CommandContribution {

  @Autowired()
  private explorerResourceService: ExplorerResourceService;

  @Autowired()
  private filetreeService: FileTreeService;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(EXPLORER_COMMANDS.LOCATION, {
      execute: (uri?: URI) => {
        if (!uri) {
          uri = this.filetreeService.getSelectedFileItem()[0];
        }
        this.explorerResourceService.location(uri);
      },
    });
  }

}
