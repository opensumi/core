import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Domain, Command, ClientAppContribution, PreferenceService, JsonSchemaContribution, ISchemaRegistry } from '@ali/ide-core-browser';
import { ITaskService } from '../common';
import { schema, taskSchemaUri } from './task.schema';

@Domain(ClientAppContribution, CommandContribution, JsonSchemaContribution)
export class TaskContribution implements ClientAppContribution, CommandContribution, JsonSchemaContribution {
  static readonly RUN_TASK_COMMAND: Command = {
    id: 'workbench.action.tasks.runTask',
    label: '运行任务',
    category: 'Task',
  };

  @Autowired(ITaskService)
  taskService: ITaskService;

  @Autowired(PreferenceService)
  prefereces: PreferenceService;

  registerSchema(registry: ISchemaRegistry) {
    registry.registerSchema(taskSchemaUri, schema, ['tasks.json']);
  }

  initialize() {
    this.prefereces.onPreferenceChanged((e) => {
      console.log('onPreferenceChanged', e.preferenceName);
    });
  }

  registerCommands(commandRegister: CommandRegistry) {
    commandRegister.registerCommand(TaskContribution.RUN_TASK_COMMAND, {
      execute: () => {
        this.taskService.runTaskCommand();
      },
    });
  }
}
