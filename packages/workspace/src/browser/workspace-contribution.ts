import { Autowired } from '@ali/common-di';

import {
  CommandRegistry,
  ClientAppContribution,
  Command,
  Domain,
} from '@ali/ide-core-browser';

import { WorkspaceService } from './workspace-service';

@Domain(ClientAppContribution)
export class WorkspaceContribution implements ClientAppContribution {

  @Autowired(WorkspaceService)
  protected readonly workspaceService: WorkspaceService;

  @Autowired(CommandRegistry)
  protected readonly commandRegistry: CommandRegistry;

  // 因为获取对应的workspace下存储的数据为异步操作
  // 需要在视图加载时进行获取，保障后续可直接使用
  // 如： 最近使用的命令，最近的工作区等
  async onStart() {
    const recentCommands: Command[] = await this.workspaceService.recentCommands();
    this.commandRegistry.setRecentCommands(recentCommands);
  }

  // 关闭前存储工作区
  onStop(): void {
    this.workspaceService.setMostRecentlyUsedWorkspace();
  }
}
