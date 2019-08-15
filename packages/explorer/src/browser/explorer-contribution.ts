import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, ClientAppContribution, EXPLORER_COMMANDS, URI, Domain, KeybindingContribution, KeybindingRegistry, FILE_COMMANDS } from '@ali/ide-core-browser';
import { ExplorerResourceService } from './explorer-resource.service';
import { FileTreeService, FileUri } from '@ali/ide-file-tree';
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
          locationUri = this.filetreeService.getSelectedFileItem()[0];
        }
        if (locationUri) {
          this.explorerResourceService.location(locationUri);
        }
      },
    });
    commands.registerCommand(FILE_COMMANDS.COLLAPSE_ALL, {
      execute: (uri?: URI) => {
        if (!uri) {
          uri = this.filetreeService.root;
        }
        this.filetreeService.collapseAll(uri);
      },
    });
    commands.registerCommand(FILE_COMMANDS.REFRESH_ALL, {
      execute: async (uri: URI) => {
        if (!uri) {
          uri = this.filetreeService.root;
        }
        const locationUri = this.filetreeService.getSelectedFileItem()[0];
        if (locationUri) {
          await this.explorerResourceService.location(locationUri);
        }

        this.filetreeService.refreshAll(uri);

      },
    });
    commands.registerCommand(FILE_COMMANDS.DELETE_FILE, {
      execute: (data: FileUri) => {
        if (data) {
          const { uris } = data;
          if (uris && uris.length) {
            this.filetreeService.deleteFiles(uris);
          }
        }
      },
      isVisible: () => {
        return this.filetreeService.focusedFiles.length > 0;
      },
    });
    commands.registerCommand(FILE_COMMANDS.RENAME_FILE, {
      execute: (data: FileUri) => {
        // 默认使用uris中下标为0的uri作为创建基础
        if (data) {
          const { uris } = data;
          if (uris && uris.length) {
            this.filetreeService.renameTempFile(uris[0]);
          }
        }
      },
      isVisible: () => {
        return this.filetreeService.focusedFiles.length > 0;
      },
    });
    commands.registerCommand(FILE_COMMANDS.NEW_FILE, {
      execute: async (data?: FileUri) => {
        const selectedFile = this.filetreeService.getSelectedFileItem();
        let fromUri: URI;
        // 只处理单选情况下的创建
        if (selectedFile.length === 1) {
          fromUri = selectedFile[0];
        } else {
          if (data) {
            const { uris } = data;
            fromUri = uris[0];
          } else {
            fromUri = this.filetreeService.root;
          }
        }
        const tempFileUri = await this.filetreeService.createTempFile(fromUri.toString());
        if (tempFileUri) {
          await this.explorerResourceService.location(tempFileUri);
        }

      },
    });
    commands.registerCommand(FILE_COMMANDS.NEW_FOLDER, {
      execute: async (data?: FileUri) => {
        const selectedFile = this.filetreeService.getSelectedFileItem();
        let fromUri: URI;
        // 只处理单选情况下的创建
        if (selectedFile.length === 1) {
          fromUri = selectedFile[0];
        } else {
          if (data) {
            const { uris } = data;
            fromUri = uris[0];
          } else {
            fromUri = this.filetreeService.root;
          }
        }
        const tempFileUri = await this.filetreeService.createTempFolder(fromUri.toString());
        if (tempFileUri) {
          await this.explorerResourceService.location(tempFileUri);
        }
      },
    });
    commands.registerCommand(FILE_COMMANDS.COMPARE_SELECTED, {
      execute: (data: FileUri) => {
        if (data) {
          const { uris } = data;
          if (uris && uris.length) {
            if (uris.length < 2) {
              return;
            }
            this.filetreeService.compare(uris[0], uris[1]);
          }
        }
      },
      isVisible: () => {
        return this.filetreeService.focusedFiles.length === 2;
      },
    });
    commands.registerCommand(FILE_COMMANDS.OPEN_RESOURCES, {
      execute: (data: FileUri) => {
        if (data) {
          const { uris } = data;
          this.filetreeService.openAndFixedFile(uris[0]);
        }
      },
      isVisible: () => {
        return this.filetreeService.focusedFiles.length === 1 && !this.filetreeService.focusedFiles[0].filestat.isDirectory;
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
    registry.register('@ali/ide-explorer', [
      {
        component: Explorer,
        id: 'file-explorer',
        name: 'file-explorer',
      },
    ], {
      iconClass: 'volans_icon code_editor',
      title: 'EXPLORER',
      weight: 10,
      containerId: 'explorer',
    });
  }

}
