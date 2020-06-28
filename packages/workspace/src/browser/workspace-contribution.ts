import { Autowired } from '@ali/common-di';

import {
  CommandRegistry,
  ClientAppContribution,
  Domain,
  PreferenceContribution,
  PreferenceSchema,
  IContextKeyService,
  FsProviderContribution,
} from '@ali/ide-core-browser';

import { IWorkspaceService } from '../common';
import { workspacePreferenceSchema } from './workspace-preferences';
import { WorkspaceService } from './workspace-service';

@Domain(ClientAppContribution, PreferenceContribution, FsProviderContribution)
export class WorkspaceContribution implements ClientAppContribution, PreferenceContribution, FsProviderContribution {

  @Autowired(IWorkspaceService)
  protected readonly workspaceService: WorkspaceService;

  @Autowired(CommandRegistry)
  protected readonly commandRegistry: CommandRegistry;

  @Autowired(IContextKeyService)
  protected readonly contextKeyService: IContextKeyService;

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

  // 关闭前存储工作区
  async onStop() {
    // Do nothing
  }

  onFileServiceReady() {
    this.workspaceService.whenReady = this.workspaceService.init();
  }

}
