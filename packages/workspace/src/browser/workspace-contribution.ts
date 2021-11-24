import { Autowired } from '@opensumi/di';

import {
  CommandRegistry,
  ClientAppContribution,
  Domain,
  PreferenceContribution,
  PreferenceSchema,
  FsProviderContribution,
  CommandContribution,
  WORKSPACE_COMMANDS,
  localize,
  URI,
} from '@opensumi/ide-core-browser';

import { IWorkspaceService, KAITIAN_MULTI_WORKSPACE_EXT } from '../common';
import { workspacePreferenceSchema } from './workspace-preferences';
import { WorkspaceService } from './workspace-service';
import { IWindowDialogService } from '@opensumi/ide-overlay';
import { WorkspaceContextKey } from './workspace-contextkey';

@Domain(ClientAppContribution, PreferenceContribution, FsProviderContribution, CommandContribution)
export class WorkspaceContribution implements ClientAppContribution, PreferenceContribution, FsProviderContribution, CommandContribution {

  @Autowired(IWorkspaceService)
  protected readonly workspaceService: WorkspaceService;

  @Autowired(CommandRegistry)
  protected readonly commandRegistry: CommandRegistry;

  @Autowired(WorkspaceContextKey)
  protected readonly workspaceContextKey: WorkspaceContextKey;

  @Autowired(IWindowDialogService)
  protected readonly windowDialogService: IWindowDialogService;

  schema: PreferenceSchema = workspacePreferenceSchema;

  protected async initWorkspaceContextKeys() {
    await this.workspaceService.whenReady;
    const updateWorkspaceFolderCountKey = () => {
      const roots = this.workspaceService.tryGetRoots();
      this.workspaceContextKey.workbenchStateContextKey.set(roots.length > 1 ? 'workspace' : 'folder');
      this.workspaceContextKey.workspaceFolderCountContextKey.set(roots.length);
    };
    updateWorkspaceFolderCountKey();
    this.workspaceService.onWorkspaceLocationChanged(updateWorkspaceFolderCountKey);
  }

  async onStart() {
    this.initWorkspaceContextKeys();
  }

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand(WORKSPACE_COMMANDS.ADD_WORKSPACE_FOLDER, {
      execute: async () => {
        const folder = await this.windowDialogService.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
        });
        if (folder && folder.length > 0) {
          await this.workspaceService.addRoot(folder[0]);
        }
      },
    });

    registry.registerCommand(WORKSPACE_COMMANDS.SAVE_WORKSPACE_AS_FILE, {
      execute: async () => {
        if (!this.workspaceService.isMultiRootWorkspaceOpened) {
          // 非工作区模式下调用无效
          return;
        }
        const folder = await this.windowDialogService.showSaveDialog({
          saveLabel: localize('workspace.saveWorkspaceAsFile'),
          showNameInput: true,
          defaultFileName: `workspace.${KAITIAN_MULTI_WORKSPACE_EXT}`,
        });
        if (folder) {
          await this.workspaceService.save(folder);
        }
      },
    });

    registry.registerCommand(WORKSPACE_COMMANDS.REMOVE_WORKSPACE_FOLDER, {
      execute: async (_: URI, uris: URI[]) => {
        if (!uris.length || !this.workspaceService.isMultiRootWorkspaceOpened) {
          return ;
        }
        const roots = await this.workspaceService.roots;
        const workspaceUris = uris.filter((uri) => {
          return roots.find((file) => file.uri === uri.toString());
        });
        if (workspaceUris.length > 0) {
          await this.workspaceService.removeRoots(workspaceUris);
        }
      },
    });
  }

  onFileServiceReady() {
    this.workspaceService.init();
  }
}
