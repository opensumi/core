import { Autowired, Injectable } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import {
  ILogger,
  IDisposable,
  uuid,
  formatLocalize,
  Uri,
  withNullAsUndefined,
  ITaskDefinitionRegistry,
  isString,
  URI,
  Disposable,
} from '@opensumi/ide-core-common';
import { ITaskService, ITaskProvider, IWorkspaceFolder } from '@opensumi/ide-task/lib/common';
import { KeyedTaskIdentifier, TaskEventKind, TaskExecution } from '@opensumi/ide-task/lib/common/task';
import {
  PresentationOptions,
  RunOptions,
  CommandOptions,
  CommandConfiguration,
  RuntimeType,
  TaskSource,
  TaskSourceKind,
  ExtensionTaskSource,
  TaskScope,
  Task,
  ConfiguringTask,
  CustomTask,
  ContributedTask,
} from '@opensumi/ide-task/lib/common/task';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { ExtHostAPIIdentifier } from '../../../common/vscode';
import {
  IMainThreadTasks,
  IExtHostTasks,
  RunOptionsDTO,
  TaskPresentationOptionsDTO,
  TaskDefinitionDTO,
  ProcessExecutionOptionsDTO,
  ShellExecutionDTO,
  ProcessExecutionDTO,
  CustomExecution2DTO,
  CustomExecutionDTO,
  TaskDTO,
  ShellExecutionOptionsDTO,
  TaskSourceDTO,
  TaskFilterDTO,
  TaskExecutionDTO,
  TaskHandleDTO,
  TaskProcessStartedDTO,
  TaskProcessEndedDTO,
} from '../../../common/vscode/tasks';

namespace TaskHandleDTO {
  export function is(value: any): value is TaskHandleDTO {
    const candidate: TaskHandleDTO = value;
    return candidate && isString(candidate.id) && !!candidate.workspaceFolder;
  }
}

namespace TaskExecutionDTO {
  export function from(value: TaskExecution): TaskExecutionDTO {
    return {
      id: value.id,
      task: TaskDTO.from(value.task),
    };
  }
}

namespace TaskProcessStartedDTO {
  export function from(value: TaskExecution, processId: number): TaskProcessStartedDTO {
    return {
      id: value.id,
      processId,
    };
  }
}

namespace TaskProcessEndedDTO {
  export function from(value: TaskExecution, exitCode: number): TaskProcessEndedDTO {
    return {
      id: value.id,
      exitCode,
    };
  }
}

namespace TaskDefinitionDTO {
  export function from(value: KeyedTaskIdentifier): TaskDefinitionDTO {
    const result = Object.assign(Object.create(null), value);
    delete result._key;
    return result;
  }
  export function to(value: TaskDefinitionDTO, executeOnly: boolean, context): KeyedTaskIdentifier | undefined {
    let result = context.createTaskIdentifier(value, console);
    if (result === undefined && executeOnly) {
      result = {
        _key: uuid(),
        type: '$executeOnly',
      };
    }
    return result;
  }
}

namespace TaskPresentationOptionsDTO {
  export function from(value: PresentationOptions | undefined): TaskPresentationOptionsDTO | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    return Object.assign(Object.create(null), value);
  }
  export function to(value: TaskPresentationOptionsDTO | undefined): PresentationOptions {
    if (value === undefined || value === null) {
      return PresentationOptions.defaults;
    }
    return Object.assign(Object.create(null), PresentationOptions.defaults, value);
  }
}

namespace RunOptionsDTO {
  export function from(value: RunOptions): RunOptionsDTO | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    return Object.assign(Object.create(null), value);
  }
  export function to(value: RunOptionsDTO | undefined): RunOptions {
    if (value === undefined || value === null) {
      return RunOptions.defaults;
    }
    return Object.assign(Object.create(null), RunOptions.defaults, value);
  }
}

namespace ProcessExecutionOptionsDTO {
  export function from(value: CommandOptions): ProcessExecutionOptionsDTO | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    return {
      cwd: value.cwd,
      env: value.env,
    };
  }
  export function to(value: ProcessExecutionOptionsDTO | undefined): CommandOptions {
    if (value === undefined || value === null) {
      return CommandOptions.defaults;
    }
    return {
      cwd: value.cwd || CommandOptions.defaults.cwd,
      env: value.env,
    };
  }
}

namespace ProcessExecutionDTO {
  export function is(
    value: ShellExecutionDTO | ProcessExecutionDTO | CustomExecutionDTO | CustomExecution2DTO,
  ): value is ProcessExecutionDTO {
    const candidate = value as ProcessExecutionDTO;
    return candidate && !!candidate.process;
  }
  export function from(value: CommandConfiguration): ProcessExecutionDTO {
    const process: string = isString(value.name) ? value.name : value.name!.value;
    const args: string[] = value.args ? value.args.map((value) => (isString(value) ? value : value.value)) : [];
    const result: ProcessExecutionDTO = {
      process,
      args,
    };
    if (value.options) {
      result.options = ProcessExecutionOptionsDTO.from(value.options);
    }
    return result;
  }
  export function to(value: ProcessExecutionDTO): CommandConfiguration {
    const result: CommandConfiguration = {
      runtime: RuntimeType.Process,
      name: value.process,
      args: value.args,
      presentation: undefined,
    };
    result.options = ProcessExecutionOptionsDTO.to(value.options);
    return result;
  }
}

namespace ShellExecutionOptionsDTO {
  export function from(value: CommandOptions): ShellExecutionOptionsDTO | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    const result: ShellExecutionOptionsDTO = {
      cwd: value.cwd || CommandOptions.defaults.cwd,
      env: value.env,
    };
    if (value.shell) {
      result.executable = value.shell.executable;
      result.shellArgs = value.shell.args;
      result.shellQuoting = value.shell.quoting;
    }
    return result;
  }
  export function to(value: ShellExecutionOptionsDTO): CommandOptions | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    const result: CommandOptions = {
      cwd: value.cwd,
      env: value.env,
    };
    if (value.executable) {
      result.shell = {
        executable: value.executable,
      };
      if (value.shellArgs) {
        result.shell.args = value.shellArgs;
      }
      if (value.shellQuoting) {
        result.shell.quoting = value.shellQuoting;
      }
    }
    return result;
  }
}

namespace ShellExecutionDTO {
  export function is(
    value: ShellExecutionDTO | ProcessExecutionDTO | CustomExecutionDTO | CustomExecution2DTO,
  ): value is ShellExecutionDTO {
    const candidate = value as ShellExecutionDTO;
    return candidate && (!!candidate.commandLine || !!candidate.command);
  }
  export function from(value: CommandConfiguration): ShellExecutionDTO {
    const result: ShellExecutionDTO = {};
    if (
      value.name &&
      isString(value.name) &&
      (value.args === undefined || value.args === null || value.args.length === 0)
    ) {
      result.commandLine = value.name;
    } else {
      result.command = value.name;
      result.args = value.args;
    }
    if (value.options) {
      result.options = ShellExecutionOptionsDTO.from(value.options);
    }
    return result;
  }
  export function to(value: ShellExecutionDTO): CommandConfiguration {
    const result: CommandConfiguration = {
      runtime: RuntimeType.Shell,
      name: value.commandLine ? value.commandLine : value.command,
      args: value.args,
      presentation: undefined,
    };
    if (value.options) {
      result.options = ShellExecutionOptionsDTO.to(value.options);
    }
    return result;
  }
}

namespace CustomExecutionDTO {
  export function is(
    value: ShellExecutionDTO | ProcessExecutionDTO | CustomExecutionDTO | CustomExecution2DTO,
  ): value is CustomExecutionDTO {
    const candidate = value as CustomExecutionDTO;
    return candidate && candidate.customExecution === 'customExecution';
  }

  export function from(): CustomExecutionDTO {
    return {
      customExecution: 'customExecution',
    };
  }

  export function to(): CommandConfiguration {
    return {
      runtime: RuntimeType.CustomExecution,
      presentation: undefined,
    };
  }
}

namespace CustomExecution2DTO {
  export function is(
    value: ShellExecutionDTO | ProcessExecutionDTO | CustomExecutionDTO | CustomExecution2DTO,
  ): value is CustomExecution2DTO {
    const candidate = value as CustomExecution2DTO;
    return candidate && candidate.customExecution === 'customExecution2';
  }

  export function from(): CustomExecution2DTO {
    return {
      customExecution: 'customExecution2',
    };
  }

  export function to(): CommandConfiguration {
    return {
      runtime: RuntimeType.CustomExecution2,
      presentation: undefined,
    };
  }
}

namespace TaskSourceDTO {
  export function from(value: TaskSource): TaskSourceDTO {
    const result: TaskSourceDTO = {
      label: value.label,
    };
    if (value.kind === TaskSourceKind.Extension) {
      result.extensionId = value.extension;
      if (value.workspaceFolder) {
        result.scope = value.workspaceFolder.uri;
      } else {
        result.scope = value.scope;
      }
    } else if (value.kind === TaskSourceKind.Workspace) {
      result.extensionId = '$core';
      result.scope = value.config.workspaceFolder!.uri;
    }
    return result;
  }
  export function to(value: TaskSourceDTO, workspace: IWorkspaceService): ExtensionTaskSource {
    let scope: TaskScope;
    let workspaceFolder: IWorkspaceFolder | undefined;
    const folders = workspace.tryGetRoots().map((stat) => Uri.parse(stat.uri));
    if (value.scope === undefined || (typeof value.scope === 'number' && value.scope !== TaskScope.Global)) {
      if (workspace.tryGetRoots().map((stat) => Uri.file(stat.uri)).length === 0) {
        scope = TaskScope.Global;
        workspaceFolder = undefined;
      } else {
        scope = TaskScope.Folder;
        workspaceFolder = { name: 'workspace', uri: folders[0], index: 0 };
      }
    } else if (typeof value.scope === 'number') {
      scope = value.scope;
    } else {
      scope = TaskScope.Folder;
      workspaceFolder = withNullAsUndefined({
        uri: workspace.tryGetRoots().map((stat) => Uri.parse(stat.uri))[0],
        name: workspace.getWorkspaceName(workspace.tryGetRoots().map((stat) => URI.file(stat.uri))[0]),
        index: 0,
      });
    }
    const result: ExtensionTaskSource = {
      kind: TaskSourceKind.Extension,
      label: value.label,
      extension: value.extensionId,
      scope,
      workspaceFolder,
    };
    return result;
  }
}

namespace TaskDTO {
  export function from(task: Task | ConfiguringTask): TaskDTO | undefined {
    if (
      task === undefined ||
      task === null ||
      (!CustomTask.is(task) && !ContributedTask.is(task) && !ConfiguringTask.is(task))
    ) {
      return undefined;
    }
    const result: TaskDTO = {
      _id: task._id,
      name: task.configurationProperties.name,
      definition: TaskDefinitionDTO.from(task.getDefinition()),
      source: TaskSourceDTO.from(task._source),
      execution: undefined,
      presentationOptions:
        !ConfiguringTask.is(task) && task.command
          ? TaskPresentationOptionsDTO.from(task.command.presentation)
          : undefined,
      isBackground: task.configurationProperties.isBackground,
      problemMatchers: [],
      hasDefinedMatchers: ContributedTask.is(task) ? task.hasDefinedMatchers : false,
      runOptions: RunOptionsDTO.from(task.runOptions),
    };
    if (task.configurationProperties.group) {
      result.group = task.configurationProperties.group;
    }
    if (!ConfiguringTask.is(task) && task.command) {
      if (task.command.runtime === RuntimeType.Process) {
        result.execution = ProcessExecutionDTO.from(task.command);
      } else if (task.command.runtime === RuntimeType.Shell) {
        result.execution = ShellExecutionDTO.from(task.command);
      }
    }
    if (task.configurationProperties.problemMatchers) {
      for (const matcher of task.configurationProperties.problemMatchers) {
        if (isString(matcher)) {
          result.problemMatchers.push(matcher);
        }
      }
    }
    return result;
  }

  export function to(
    task: TaskDTO | undefined,
    workspace: IWorkspaceService,
    executeOnly: boolean,
    context,
  ): ContributedTask | undefined {
    if (!task || typeof task.name !== 'string') {
      return undefined;
    }

    let command: CommandConfiguration | undefined;
    if (task.execution) {
      if (ShellExecutionDTO.is(task.execution)) {
        command = ShellExecutionDTO.to(task.execution);
      } else if (ProcessExecutionDTO.is(task.execution)) {
        command = ProcessExecutionDTO.to(task.execution);
      } else if (CustomExecutionDTO.is(task.execution)) {
        command = CustomExecutionDTO.to();
      }
    }

    if (!command) {
      return undefined;
    }
    command.presentation = TaskPresentationOptionsDTO.to(task.presentationOptions);
    const source = TaskSourceDTO.to(task.source, workspace);

    const label = formatLocalize('task.label', source.label, task.name);
    const definition = TaskDefinitionDTO.to(task.definition, executeOnly, context)!;
    const id = `${task.source.extensionId}.${definition._key}`;
    const result: ContributedTask = new ContributedTask(
      id, // uuidMap.getUUID(identifier)
      source,
      label,
      definition.type,
      definition,
      command,
      task.hasDefinedMatchers,
      RunOptionsDTO.to(task.runOptions),
      {
        name: task.name,
        identifier: label,
        group: task.group,
        isBackground: !!task.isBackground,
        problemMatchers: task.problemMatchers.slice(),
      },
    );
    return result;
  }
}

@Injectable({ multiple: true })
export class MainthreadTasks extends Disposable implements IMainThreadTasks {
  protected readonly proxy: IExtHostTasks;

  private providers: Map<number, { disposable: IDisposable; provider: ITaskProvider }>;

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(ITaskService)
  taskService: ITaskService;

  @Autowired(IWorkspaceService)
  workspaceService: IWorkspaceService;

  @Autowired(ITaskDefinitionRegistry)
  taskDefinitionRegistry: ITaskDefinitionRegistry;

  private context: { createTaskIdentifier: (identifier, reporter) => KeyedTaskIdentifier | undefined };

  constructor(private rpcProtocol: IRPCProtocol) {
    super();
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostTasks);
    this.providers = new Map();
    this.context = {
      createTaskIdentifier: (identifier, reporter) =>
        this.taskDefinitionRegistry.createTaskIdentifier(identifier, reporter),
    };

    this.addDispose(
      this.taskService.onDidStateChange((event) => {
        const task = event.__task!;
        if (event.kind === TaskEventKind.Start) {
          this.logger.verbose(`task ${task._label || task._id} start`, event.terminalId);
          this.proxy.$onDidStartTask(TaskExecutionDTO.from(task.getTaskExecution()), event.terminalId!);
        } else if (event.kind === TaskEventKind.ProcessStarted) {
          this.logger.verbose(`task ${task._label || task._id} process start`, event.processId);
          this.proxy.$onDidStartTaskProcess(TaskProcessStartedDTO.from(task.getTaskExecution(), event.processId!));
        } else if (event.kind === TaskEventKind.ProcessEnded) {
          this.logger.verbose(`task ${task._label || task._id} process end`, event.exitCode);
          this.proxy.$onDidEndTaskProcess(TaskProcessEndedDTO.from(task.getTaskExecution(), event.exitCode!));
        } else if (event.kind === TaskEventKind.End) {
          this.logger.verbose(`task ${task._label || task._id} end`);
          this.proxy.$onDidEndTask(TaskExecutionDTO.from(task.getTaskExecution()));
        }
      }),
    );
  }

  dispose() {
    super.dispose();

    this.providers.forEach((item) => item.disposable.dispose());
    this.providers.clear();
  }

  $registerTaskProvider(handler: number, type: string): Promise<void> {
    this.logger.verbose(`register task provider ${type}, handler ${handler}`);
    const provider: ITaskProvider = {
      // @ts-ignore
      provideTasks: (validTypes: Record<string, boolean>) => {
        this.logger.verbose(`${type} provideTask`);
        return Promise.resolve(this.proxy.$provideTask(handler, validTypes)).then((result) => {
          const tasks: Task[] = [];
          for (const dto of result.tasks) {
            const task = TaskDTO.to(dto, this.workspaceService, true, this.context);
            if (task) {
              tasks.push(task);
            } else {
              this.logger.error(
                `Task System: can not convert task: ${JSON.stringify(
                  dto.definition,
                  undefined,
                  0,
                )}. Task will be dropped`,
              );
            }
          }
          return {
            tasks,
            extension: result.extension,
            type,
          };
        });
      },
      // @ts-ignore
      resolveTask: (task: ConfiguringTask) => {
        this.logger.verbose(`${type} resolveTask`);
        return Promise.resolve(this.proxy.$resolveTask(handler, task)).then((resolvedTask) => {
          if (resolvedTask) {
            return TaskDTO.to(resolvedTask, this.workspaceService, true, this.context);
          }
          return undefined;
        });
      },
    };
    const disposable = this.taskService.registerTaskProvider(provider, type);
    this.providers.set(handler, { disposable, provider });
    return Promise.resolve();
  }

  $unregisterTaskProvider(type: string): Promise<any> {
    throw new Error('Method not implemented.');
  }

  $fetchTasks(filter) {
    return this.taskService.tasks(TaskFilterDTO.to(filter)).then((tasks) => {
      const result: TaskDTO[] = [];
      for (const task of tasks) {
        const item = TaskDTO.from(task);
        if (item) {
          result.push(item);
        }
      }
      return result;
    });
  }

  $executeTask(value: TaskHandleDTO | TaskDTO): Promise<TaskExecutionDTO> {
    return new Promise<TaskExecutionDTO>((resolve, reject) => {
      if (TaskHandleDTO.is(value)) {
        const workspaceFolder = this.workspaceService.getWorkspaceRootUri(URI.from(value.workspaceFolder));
        if (workspaceFolder) {
          this.taskService.getTask(workspaceFolder.codeUri, value.id, true).then(
            (task: Task) => {
              this.taskService.run(task).then(() => {
                // eat the error, it has already been surfaced to the user and we don't care about it here
              });
              const result: TaskExecutionDTO = {
                id: value.id,
                task: TaskDTO.from(task),
              };
              resolve(result);
            },
            (_error) => {
              reject(new Error('Task not found'));
            },
          );
        } else {
          reject(new Error('No workspace folder'));
        }
      } else {
        const task = TaskDTO.to(value, this.workspaceService, true, this.context)!;
        this.taskService.run(task).then(() => {
          // eat the error, it has already been surfaced to the user and we don't care about it here
        });
        const result: TaskExecutionDTO = {
          id: task._id,
          task: TaskDTO.from(task),
        };
        resolve(result);
      }
    });
  }

  $createTaskId(taskDTO: TaskDTO): Promise<string> {
    return new Promise((resolve, reject) => {
      const task = TaskDTO.to(taskDTO, this.workspaceService, true, this.context);
      if (task) {
        resolve(task._id);
      } else {
        reject(new Error('Task could not be created from DTO'));
      }
    });
  }

  async $terminateTask(executionId: string): Promise<void> {
    await this.taskService.terminateTask(executionId);
  }
}
