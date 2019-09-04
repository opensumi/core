import { Autowired } from '@ali/common-di';

import {
  CommandRegistry,
  ClientAppContribution,
  Command,
  Domain,
  PreferenceContribution,
  PreferenceSchema,
  IContextKeyService,
  CommandService,
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

  @Autowired(CommandService)
  private commandService: CommandService;

  schema: PreferenceSchema = workspacePreferenceSchema;

  protected initWorkspaceContextKeys(): void {
    const workspaceFolderCountKey = this.contextKeyService.createKey<number>('workspaceFolderCount', 0);
    const updateWorkspaceFolderCountKey = () => workspaceFolderCountKey.set(this.workspaceService.tryGetRoots().length);
    updateWorkspaceFolderCountKey();
    this.workspaceService.onWorkspaceChanged(updateWorkspaceFolderCountKey);
  }

  // 因为获取对应的workspace下存储的数据为异步操作
  // 需要在视图加载时进行获取，保障后续可直接使用
  // 如： 最近使用的命令，最近的工作区等
  async onStart() {
    this.workspaceService.recentCommands().then((recentCommands: Command[]) => {
      if (recentCommands && recentCommands.length) {
        recentCommands = recentCommands.map((command) => this.commandRegistry.getCommand(command.id)!);
        this.commandRegistry.setRecentCommands(recentCommands.reverse());
        // TODO 存储转换过后的 command @魁梧
      }
      this.initWorkspaceContextKeys();
    });
  }

  // 关闭前存储工作区
  async onStop() {
    await this.workspaceService.setMostRecentlyUsedWorkspace();
  }

}
