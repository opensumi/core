import { Autowired } from '@ali/common-di';

import {
  CommandRegistry,
  ClientAppContribution,
  Domain,
  PreferenceContribution,
  PreferenceSchema,
  IContextKeyService,
} from '@ali/ide-core-browser';

import { IWorkspaceService } from '../common';
import { workspacePreferenceSchema } from './workspace-preferences';

@Domain(ClientAppContribution, PreferenceContribution)
export class WorkspaceContribution implements ClientAppContribution, PreferenceContribution {

  @Autowired(IWorkspaceService)
  protected readonly workspaceService: IWorkspaceService;

  @Autowired(CommandRegistry)
  protected readonly commandRegistry: CommandRegistry;

  @Autowired(IContextKeyService)
  protected readonly contextKeyService: IContextKeyService;

  schema: PreferenceSchema = workspacePreferenceSchema;

  protected initWorkspaceContextKeys(): void {
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

}
