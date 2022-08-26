import { Autowired } from '@opensumi/di';
import {
  CommandContribution,
  CommandRegistry,
  Domain,
  Command,
  JsonSchemaContribution,
  IJSONSchemaRegistry,
  WithEventBus,
  TerminalClientAttachEvent,
  OnEvent,
} from '@opensumi/ide-core-browser';
import { ITerminalController } from '@opensumi/ide-terminal-next/lib/common/controller';

import { ITaskService } from '../common';

import { schema, taskSchemaUri } from './task.schema';

const Category = 'Tasks';

@Domain(CommandContribution, JsonSchemaContribution)
export class TaskContribution extends WithEventBus implements CommandContribution, JsonSchemaContribution {
  // 因为部分插件会执行 Task 相关的命令，所以如果你要添加 Task 相关的命令：
  // 请注意要和 VSCode 的同功能命名对齐，可以通过插件进程的 delegate 逻辑做命令调用的转发
  static readonly RUN_TASK_COMMAND: Command = {
    id: 'workbench.action.tasks.runTask',
    label: '%workbench.action.tasks.runTask%',
    category: Category,
  };
  static readonly RERUN_TASK: Command = {
    id: 'workbench.action.tasks.reRunTask',
    label: '%workbench.action.tasks.reRunTask%',
    category: Category,
  };

  @Autowired(ITerminalController)
  protected readonly terminalController: ITerminalController;

  @Autowired(ITaskService)
  private readonly taskService: ITaskService;

  @OnEvent(TerminalClientAttachEvent)
  handleTerminalClientAttach(event: TerminalClientAttachEvent) {
    const client = this.terminalController.clients.get(event.payload.clientId);
    if (!client) {
      return;
    }

    if (client.isTaskExecutor && client.taskId) {
      this.taskService.attach(client.taskId, client);
    }
  }

  registerSchema(registry: IJSONSchemaRegistry) {
    registry.registerSchema(taskSchemaUri, schema, ['tasks.json']);
  }

  registerCommands(commandRegister: CommandRegistry) {
    commandRegister.registerCommand(TaskContribution.RUN_TASK_COMMAND, {
      execute: () => {
        this.taskService.runTaskCommand();
      },
    });
    commandRegister.registerCommand(TaskContribution.RERUN_TASK, {
      execute: () => {
        this.taskService.rerunLastTask();
      },
    });
  }
}
