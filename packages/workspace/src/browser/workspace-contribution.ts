import { Autowired } from '@ali/common-di';

import {
  CommandRegistry,
  ClientAppContribution,
  Domain,
  PreferenceContribution,
  PreferenceSchema,
  IContextKeyService,
  FsProviderContribution,
  CommandContribution,
  WORKSPACE_COMMANDS,
  localize,
} from '@ali/ide-core-browser';

import { IWorkspaceService, KAITIAN_MULTI_WORKSPACE_EXT } from '../common';
import { workspacePreferenceSchema } from './workspace-preferences';
import { WorkspaceService } from './workspace-service';
import { IWindowDialogService } from '@ali/ide-overlay';

@Domain(ClientAppContribution, PreferenceContribution, FsProviderContribution, CommandContribution)
export class WorkspaceContribution implements ClientAppContribution, PreferenceContribution, FsProviderContribution, CommandContribution {

  @Autowired(IWorkspaceService)
  protected readonly workspaceService: WorkspaceService;

  @Autowired(CommandRegistry)
  protected readonly commandRegistry: CommandRegistry;

  @Autowired(IContextKeyService)
  protected readonly contextKeyService: IContextKeyService;

  @Autowired(IWindowDialogService)
  protected readonly windowDialogService: IWindowDialogService;

  schema: PreferenceSchema = workspacePreferenceSchema;

  protected initWorkspaceContextKeys(): void {
    const workspaceStateKey = this.contextKeyService.createKey<string>('workbenchState', 'empty');
    // TODO: 监听工作区变化
    this.workspaceService.whenReady.then(() => workspaceStateKey.set(this.workspaceService.tryGetRoots().length > 1 ? 'workspace' : 'folder'));
    const workspaceFolderCountKey = this.contextKeyService.createKey<number>('workspaceFolderCount', 0);
    const updateWorkspaceFolderCountKey = () => workspaceFolderCountKey.set(this.workspaceService.tryGetRoots().length);
    updateWorkspaceFolderCountKey();
    this.workspaceService.onWorkspaceChanged(updateWorkspaceFolderCountKey);
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
        const folder = await this.windowDialogService.showSaveDialog({
          saveLabel: localize('workspace.saveWorkspaceAsFile'),
          showNameInput: true,
          defaultFileName: `workspace.${KAITIAN_MULTI_WORKSPACE_EXT}`,
        });
        if (folder) {
          await this.workspaceService.save(folder);
        }
      },
      isEnabled: () => {
        return this.workspaceService.isMultiRootWorkspaceOpened;
      },
    });
  }

  onFileServiceReady() {
    this.workspaceService.init();
  }

}
