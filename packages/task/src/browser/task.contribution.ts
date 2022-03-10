import { Autowired } from '@opensumi/di';
import {
  CommandContribution,
  CommandRegistry,
  Domain,
  Command,
  JsonSchemaContribution,
  IJSONSchemaRegistry,
} from '@opensumi/ide-core-browser';

import { ITaskService } from '../common';

import { schema, taskSchemaUri } from './task.schema';

@Domain(CommandContribution, JsonSchemaContribution)
export class TaskContribution implements CommandContribution, JsonSchemaContribution {
  static readonly RUN_TASK_COMMAND: Command = {
    id: 'workbench.action.tasks.runTask',
    label: '运行任务',
    category: 'Task',
  };

  @Autowired(ITaskService)
  private readonly taskService: ITaskService;

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
