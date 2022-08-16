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
  // 以下命令的 ID 最好和 VSCode 保持一致，因为部分插件会执行 Task 相关的命令
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
  static readonly RESTART_RUNNING_TASK: Command = {
    id: 'workbench.action.tasks.restartTask',
    label: '%workbench.action.tasks.restartTask%',
    category: Category,
  };
  static readonly TERMINATE_TASK: Command = {
    id: 'workbench.action.tasks.terminate',
    label: '%workbench.action.tasks.terminate%',
    category: Category,
  };
  static readonly SHOW_TASK: Command = {
    id: 'workbench.action.tasks.showTasks',
    label: '%workbench.action.tasks.showTasks%',
    category: Category,
  };
  static readonly SHOW_TASK_LOG: Command = {
    id: 'workbench.action.tasks.showLog',
    label: '%workbench.action.tasks.showLog%',
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
    // commandRegister.registerCommand(TaskContribution.RESTART_RUNNING_TASK, {
    //   execute: () => {
    //     this.taskService.runTaskCommand();
    //   },
    // });
    // commandRegister.registerCommand(TaskContribution.SHOW_TASK, {
    //   execute: () => {
    //     this.taskService.runTaskCommand();
    //   },
    // });
    // commandRegister.registerCommand(TaskContribution.SHOW_TASK_LOG, {
    //   execute: () => {
    //     this.taskService.runTaskCommand();
    //   },
    // });
    // commandRegister.registerCommand(TaskContribution.TERMINATE_TASK, {
    //   execute: () => {
    //     this.taskService.runTaskCommand();
    //   },
    // });
  }
}
