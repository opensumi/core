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

@Domain(CommandContribution, JsonSchemaContribution)
export class TaskContribution extends WithEventBus implements CommandContribution, JsonSchemaContribution {
  static readonly RUN_TASK_COMMAND: Command = {
    id: 'workbench.action.tasks.runTask',
    label: '运行任务',
    category: 'Task',
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
  }
}
