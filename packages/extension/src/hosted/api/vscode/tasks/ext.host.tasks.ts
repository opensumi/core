/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// some code copied and modified from https://github.com/microsoft/vscode/blob/main/src/vs/workbench/api/common/extHostTask.ts

import type vscode from 'vscode';
import { TaskProvider, Task, TaskExecution, TaskFilter } from 'vscode';

import { IRPCProtocol } from '@opensumi/ide-connection';
import {
  getDebugLogger,
  Event,
  CancellationToken,
  asPromise,
  CancellationTokenSource,
  Emitter,
  DisposableStore,
  Uri,
  IDisposable,
} from '@opensumi/ide-core-common';
import { UriComponents } from '@opensumi/ide-editor/lib/common';

import { IExtensionProps } from '../../../../common';
import { MainThreadAPIIdentifier, IExtHostTerminal, IExtHostWorkspace } from '../../../../common/vscode';
import * as types from '../../../../common/vscode/ext-types';
import {
  IExtHostTasks,
  TaskHandlerData,
  IMainThreadTasks,
  TaskSetDTO,
  TaskPresentationOptionsDTO,
  ProcessExecutionOptionsDTO,
  ShellExecutionDTO,
  ProcessExecutionDTO,
  CustomExecutionDTO,
  CustomExecution2DTO,
  ShellExecutionOptionsDTO,
  TaskFilterDTO,
  TaskDTO,
  TaskDefinitionDTO,
  TaskProcessStartedDTO,
  TaskExecutionDTO,
  TaskHandleDTO,
  TaskProcessEndedDTO,
} from '../../../../common/vscode/tasks';
import { Terminal } from '../ext.host.terminal';

import { toTask, TaskDto } from './taskTypes';

namespace TaskDefinitionDTO {
  export function from(value: vscode.TaskDefinition): TaskDefinitionDTO | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    return value;
  }
  export function to(value: TaskDefinitionDTO): vscode.TaskDefinition | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    return value;
  }
}

namespace TaskPresentationOptionsDTO {
  export function from(value: vscode.TaskPresentationOptions): TaskPresentationOptionsDTO | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    return value;
  }
  export function to(value: TaskPresentationOptionsDTO): vscode.TaskPresentationOptions | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    return value;
  }
}

namespace ProcessExecutionOptionsDTO {
  export function from(value: vscode.ProcessExecutionOptions): ProcessExecutionOptionsDTO | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    return value;
  }
  export function to(value: ProcessExecutionOptionsDTO): vscode.ProcessExecutionOptions | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    return value;
  }
}

namespace ProcessExecutionDTO {
  export function is(
    value:
      | ShellExecutionDTO
      | ProcessExecutionDTO
      | CustomExecutionDTO
      | CustomExecution2DTO
      | CustomExecution2DTO
      | undefined,
  ): value is ProcessExecutionDTO {
    if (value) {
      const candidate = value as ProcessExecutionDTO;
      return candidate && !!candidate.process;
    } else {
      return false;
    }
  }
  export function from(value: types.ProcessExecution): ProcessExecutionDTO | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    const result: ProcessExecutionDTO = {
      process: value.process,
      args: value.args,
    };
    if (value.options) {
      result.options = ProcessExecutionOptionsDTO.from(value.options);
    }
    return result;
  }
  export function to(value: ProcessExecutionDTO): types.ProcessExecution | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    return new types.ProcessExecution(value.process, value.args, value.options);
  }
}

namespace ShellExecutionOptionsDTO {
  export function from(value: vscode.ShellExecutionOptions): ShellExecutionOptionsDTO | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    return value;
  }
  export function to(value: ShellExecutionOptionsDTO): vscode.ShellExecutionOptions | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    return value;
  }
}

namespace ShellExecutionDTO {
  export function is(
    value: ShellExecutionDTO | ProcessExecutionDTO | CustomExecutionDTO | CustomExecution2DTO | undefined,
  ): value is ShellExecutionDTO {
    if (value) {
      const candidate = value as ShellExecutionDTO;
      return candidate && (!!candidate.commandLine || !!candidate.command);
    } else {
      return false;
    }
  }
  export function from(value: types.ShellExecution): ShellExecutionDTO | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    const result: ShellExecutionDTO = {};
    if (value.commandLine !== undefined) {
      result.commandLine = value.commandLine;
    } else {
      result.command = value.command;
      result.args = value.args;
    }
    if (value.options) {
      result.options = ShellExecutionOptionsDTO.from(value.options);
    }
    return result;
  }
  export function to(value: ShellExecutionDTO): types.ShellExecution | undefined {
    if (value === undefined || value === null || (value.command === undefined && value.commandLine === undefined)) {
      return undefined;
    }
    if (value.commandLine) {
      return new types.ShellExecution(value.commandLine, value.options);
    } else {
      return new types.ShellExecution(value.command!, value.args ? value.args : [], value.options);
    }
  }
}

namespace CustomExecutionDTO {
  export function is(
    value: ShellExecutionDTO | ProcessExecutionDTO | CustomExecutionDTO | undefined,
  ): value is CustomExecutionDTO {
    if (value) {
      const candidate = value as CustomExecutionDTO;
      return candidate && candidate.customExecution === 'customExecution';
    } else {
      return false;
    }
  }

  export function from(value: types.CustomExecution): CustomExecutionDTO {
    return {
      customExecution: 'customExecution',
    };
  }

  export function to(
    taskId: string,
    providedCustomExecutions: Map<string, types.CustomExecution>,
  ): types.CustomExecution | undefined {
    return providedCustomExecutions.get(taskId);
  }
}

namespace TaskHandleDTO {
  export function from(value: types.Task): TaskHandleDTO {
    let folder: UriComponents | undefined;
    if (value.scope !== undefined && typeof value.scope !== 'number') {
      folder = value.scope.uri;
    }
    return {
      id: value._id!,
      workspaceFolder: folder!,
    };
  }
}

namespace CustomExecution2DTO {
  export function is(
    value: ShellExecutionDTO | ProcessExecutionDTO | CustomExecutionDTO | CustomExecution2DTO | undefined,
  ): value is CustomExecution2DTO {
    if (value) {
      const candidate = value as CustomExecution2DTO;
      return candidate && candidate.customExecution === 'customExecution2';
    } else {
      return false;
    }
  }

  export function from(value: types.CustomExecution2): CustomExecution2DTO {
    return {
      customExecution: 'customExecution2',
    };
  }
}

namespace TaskDTO {
  export function fromMany(tasks: vscode.Task[], extension: IExtensionProps): TaskDTO[] {
    if (tasks === undefined || tasks === null) {
      return [];
    }
    const result: TaskDTO[] = [];
    for (const task of tasks) {
      const converted = from(task, extension);
      if (converted) {
        result.push(converted);
      }
    }
    return result;
  }

  export function from(value: vscode.Task, extension: IExtensionProps): TaskDTO | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    let execution: ShellExecutionDTO | ProcessExecutionDTO | CustomExecutionDTO | undefined;
    if (value.execution instanceof types.ProcessExecution) {
      execution = ProcessExecutionDTO.from(value.execution);
    } else if (value.execution instanceof types.ShellExecution) {
      execution = ShellExecutionDTO.from(value.execution);
    } else if (value.execution && value.execution instanceof types.CustomExecution) {
      execution = CustomExecutionDTO.from(value.execution as types.CustomExecution);
    }

    const definition: TaskDefinitionDTO | undefined = TaskDefinitionDTO.from(value.definition);
    let scope: number | UriComponents;
    if (value.scope) {
      if (typeof value.scope === 'number') {
        scope = value.scope;
      } else {
        scope = value.scope.uri;
      }
    } else {
      // To continue to support the deprecated task constructor that doesn't take a scope, we must add a scope here:
      scope = types.TaskScope.Workspace;
    }
    if (!definition || !scope) {
      return undefined;
    }
    const group = (value.group as types.TaskGroup) ? (value.group as types.TaskGroup).id : undefined;
    const result: TaskDTO = {
      _id: (value as types.Task)._id!,
      definition,
      name: value.name,
      source: {
        extensionId: extension.id,
        label: value.source,
        scope,
      },
      execution: execution!,
      isBackground: value.isBackground,
      group,
      presentationOptions: TaskPresentationOptionsDTO.from(value.presentationOptions),
      problemMatchers: value.problemMatchers,
      hasDefinedMatchers: (value as types.Task).hasDefinedMatchers,
      runOptions: (value as vscode.Task).runOptions ? (value as vscode.Task).runOptions : { reevaluateOnRerun: true },
    };
    return result;
  }

  export async function to(
    value: TaskDTO | undefined,
    extHostWorkspace: IExtHostWorkspace,
    providedCustomExecutions: Map<string, types.CustomExecution>,
  ): Promise<types.Task | undefined> {
    if (value === undefined || value === null) {
      return undefined;
    }
    let execution: types.ShellExecution | types.ProcessExecution | types.CustomExecution | undefined;
    if (ProcessExecutionDTO.is(value.execution)) {
      execution = ProcessExecutionDTO.to(value.execution);
    } else if (ShellExecutionDTO.is(value.execution)) {
      execution = ShellExecutionDTO.to(value.execution);
    } else if (CustomExecutionDTO.is(value.execution)) {
      execution = CustomExecutionDTO.to(value._id, providedCustomExecutions);
    }
    const definition: vscode.TaskDefinition | undefined = TaskDefinitionDTO.to(value.definition);
    let scope: types.TaskScope.Global | types.TaskScope.Workspace | vscode.WorkspaceFolder | undefined;
    if (value.source) {
      if (value.source.scope !== undefined) {
        if (typeof value.source.scope === 'number') {
          scope = value.source.scope;
        } else {
          scope = extHostWorkspace.getWorkspaceFolder(Uri.from(value.source.scope));
        }
      } else {
        scope = types.TaskScope.Workspace;
      }
    }
    if (!definition || !scope) {
      return undefined;
    }
    const result = new types.Task(definition, scope, value.name!, value.source.label, execution, value.problemMatchers);
    if (value.isBackground !== undefined) {
      result.isBackground = value.isBackground;
    }
    if (value.group !== undefined) {
      result.group = types.TaskGroup.from(value.group);
    }
    if (value.presentationOptions) {
      result.presentationOptions = TaskPresentationOptionsDTO.to(value.presentationOptions)!;
    }
    if (value._id) {
      result._id = value._id;
    }
    return result;
  }
}

/**
 * VS Code 似乎不打算实现？
 */
class TaskExecutionImpl implements vscode.TaskExecution {
  constructor(private readonly _tasks: IExtHostTasks, readonly _id: string, private readonly _task: vscode.Task) {}

  public get task(): vscode.Task {
    return this._task;
  }

  public terminate(): void {
    this._tasks.terminateTask(this);
  }

  public fireDidStartProcess(value: TaskProcessStartedDTO): void {}

  public fireDidEndProcess(value: TaskProcessEndedDTO): void {}
}

// tslint:disable-next-line: no-unused-variable
class CustomExecutionData implements IDisposable {
  private _cancellationSource?: CancellationTokenSource;
  private readonly _onTaskExecutionComplete: Emitter<CustomExecutionData> = new Emitter<CustomExecutionData>();
  private readonly _disposables = new DisposableStore();
  private terminalId?: number;
  public result: number | undefined;

  constructor(
    // tslint:disable-next-line: no-unused-variable
    private readonly customExecution: vscode.CustomExecution,
    private readonly terminalService: IExtHostTerminal,
  ) {}

  public dispose(): void {
    this._cancellationSource = undefined;
    this._disposables.dispose();
  }

  public get onTaskExecutionComplete(): Event<CustomExecutionData> {
    return this._onTaskExecutionComplete.event;
  }

  private onDidOpenTerminal(terminal: vscode.Terminal): void {
    if (!(terminal instanceof Terminal)) {
      throw new Error('How could this not be a extension host terminal?');
    }

    if (this.terminalId && terminal.__id === String(this.terminalId)) {
      this.startCallback(this.terminalId);
    }
  }

  public async startCallback(terminalId: number): Promise<void> {
    this.terminalId = terminalId;

    // If we have already started the extension task callback, then
    // do not start it again.
    // It is completely valid for multiple terminals to be opened
    // before the one for our task.
    if (this._cancellationSource) {
      return undefined;
    }

    const callbackTerminals: vscode.Terminal[] = this.terminalService.terminals.filter(
      // @ts-ignore
      (terminal) => terminal._id === terminalId,
    );

    if (!callbackTerminals || callbackTerminals.length === 0) {
      this._disposables.add(this.terminalService.onDidOpenTerminal(this.onDidOpenTerminal.bind(this)));
      return;
    }

    if (callbackTerminals.length !== 1) {
      throw new Error('Expected to only have one terminal at this point');
    }
  }
}

export class ExtHostTasks implements IExtHostTasks {
  private handlerCounter = 0;

  private taskHandlers = new Map<number, TaskHandlerData>();

  private providedCustomExecutions2: Map<string, types.CustomExecution>;

  private notProvidedCustomExecutions: Set<string>;

  private _taskExecutions: Map<string, TaskExecutionImpl>;

  protected readonly proxy: IMainThreadTasks;

  private readonly _onDidExecuteTask: Emitter<vscode.TaskStartEvent> = new Emitter<vscode.TaskStartEvent>();
  private readonly _onDidTerminateTask: Emitter<vscode.TaskEndEvent> = new Emitter<vscode.TaskEndEvent>();

  private readonly _onDidTaskProcessStarted: Emitter<vscode.TaskProcessStartEvent> =
    new Emitter<vscode.TaskProcessStartEvent>();
  private readonly _onDidTaskProcessEnded: Emitter<vscode.TaskProcessEndEvent> =
    new Emitter<vscode.TaskProcessEndEvent>();

  constructor(
    private rpcProtocol: IRPCProtocol,
    protected readonly terminalService: IExtHostTerminal,
    protected readonly extHostWorkspace: IExtHostWorkspace,
  ) {
    this.proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadTasks);
    this.providedCustomExecutions2 = new Map();
    this.notProvidedCustomExecutions = new Set();
    this._taskExecutions = new Map();
  }

  async $onDidStartTask(execution: TaskExecutionDTO, terminalId: string): Promise<void> {
    const customExecution = this.providedCustomExecutions2.get(execution.id);
    if (customExecution) {
      this.terminalService.attachPtyToTerminal(terminalId, await customExecution.callback(execution.task?.definition));
    }

    this._onDidExecuteTask.fire({
      execution: await this.getTaskExecution(execution),
    });
  }

  public get onDidStartTask() {
    return this._onDidExecuteTask.event;
  }

  async $onDidEndTask(execution: TaskExecutionDTO): Promise<void> {
    this._onDidTerminateTask.fire({
      execution: await this.getTaskExecution(execution),
    });
  }

  public get onDidEndTask() {
    return this._onDidTerminateTask.event;
  }

  async $onDidStartTaskProcess(value: TaskProcessStartedDTO): Promise<void> {
    const execution = await this.getTaskExecution(value.id);
    if (execution) {
      this._onDidTaskProcessStarted.fire({
        execution,
        processId: value.processId,
      });
    }
  }

  get onDidStartTaskProcess() {
    return this._onDidTaskProcessStarted.event;
  }

  async $onDidEndTaskProcess(value: TaskProcessEndedDTO): Promise<void> {
    const execution = await this.getTaskExecution(value.id);
    if (execution) {
      this._onDidTaskProcessEnded.fire({
        execution,
        exitCode: value.exitCode,
      });
    }
  }

  get onDidEndTaskProcess() {
    return this._onDidTaskProcessEnded.event;
  }

  get taskExecutions(): ReadonlyArray<vscode.TaskExecution> {
    return [...this._taskExecutions.values()];
  }

  terminateTask(execution: vscode.TaskExecution) {
    return this.proxy.$terminateTask((execution as TaskExecutionImpl)._id);
  }

  registerTaskProvider(type: string, provider: TaskProvider, extension: IExtensionProps): IDisposable {
    const handler = (this.handlerCounter += 1);
    this.taskHandlers.set(handler, { type, provider, extension });
    this.proxy.$registerTaskProvider(handler, type);
    return {
      dispose: () => {
        this.taskHandlers.delete(handler);
        this.proxy.$unregisterTaskProvider(type);
      },
    };
  }

  private async getTaskExecution(execution: TaskExecutionDTO | string, task?: vscode.Task): Promise<TaskExecutionImpl> {
    if (typeof execution === 'string') {
      const taskExecution = this._taskExecutions.get(execution);
      if (!taskExecution) {
        throw new Error(`Unexpected: The specified task is missing an execution : ${execution}`);
      }
      return taskExecution;
    }

    const result: TaskExecutionImpl | undefined = this._taskExecutions.get(execution.id);
    if (result) {
      return result;
    }
    const taskToCreate = task
      ? task
      : await TaskDTO.to(execution.task, this.extHostWorkspace, this.providedCustomExecutions2);
    if (!taskToCreate) {
      throw new Error('Unexpected: Task does not exist.');
    }
    const createdResult: TaskExecutionImpl = new TaskExecutionImpl(this, execution.id, taskToCreate);
    this._taskExecutions.set(execution.id, createdResult);
    return createdResult;
  }

  async executeTask(task: Task, extension: IExtensionProps): Promise<TaskExecution> {
    const tTask = task as types.Task;
    // We have a preserved ID. So the task didn't change.
    if (tTask._id !== undefined) {
      return this.proxy.$executeTask(TaskHandleDTO.from(tTask)).then((value) => this.getTaskExecution(value, task));
    } else {
      const dto = TaskDTO.from(task, extension);
      if (dto === undefined) {
        return Promise.reject(new Error('Task is not valid'));
      }
      // If this task is a custom execution, then we need to save it away
      // in the provided custom execution map that is cleaned up after the
      // task is executed.
      if (CustomExecutionDTO.is(dto.execution)) {
        await this.addCustomExecution(dto, task, false);
      }
      return this.proxy.$executeTask(dto).then((value) => this.getTaskExecution(value, task));
    }
  }

  fetchTasks(filter?: vscode.TaskFilter | undefined): Promise<Task[]> {
    return this.proxy.$fetchTasks(TaskFilterDTO.from(filter)).then(async (values) => {
      const result: vscode.Task[] = [];
      for (const value of values) {
        const task = await TaskDTO.to(value, this.extHostWorkspace, this.providedCustomExecutions2);
        if (task) {
          result.push(task);
        }
      }
      return result;
    });
  }

  private async addCustomExecution(taskDTO: TaskDTO, task: vscode.Task, isProvided: boolean): Promise<void> {
    const taskId = await this.proxy.$createTaskId(taskDTO);
    if (!isProvided && !this.providedCustomExecutions2.has(taskId)) {
      this.notProvidedCustomExecutions.add(taskId);
    }
    this.providedCustomExecutions2.set(taskId, task.execution as types.CustomExecution);
  }

  $provideTask(handler: number, validTypes: Record<string, boolean>): Promise<TaskSetDTO> {
    const provider = this.taskHandlers.get(handler);
    if (!provider) {
      throw new Error(`taskprovider ${handler} not found`);
    }

    const taskIdPromises: Promise<void>[] = [];
    const fetching = asPromise(() => provider.provider.provideTasks(CancellationToken.None))
      .then((result) => {
        const taskDTOs: TaskDTO[] = [];
        if (result) {
          for (const task of result) {
            if (!task.definition || !validTypes[task.definition.type]) {
              getDebugLogger().warn(
                false,
                `The task [${task.source}, ${task.name}] uses an undefined task type. The task will be ignored in the future.`,
              );
            }
            const taskDTO: TaskDTO | undefined = TaskDTO.from(task, provider.extension);
            if (taskDTO) {
              taskDTOs.push(taskDTO);

              if (CustomExecutionDTO.is(taskDTO.execution)) {
                // The ID is calculated on the main thread task side, so, let's call into it here.
                // We need the task id's pre-computed for custom task executions because when OnDidStartTask
                // is invoked, we have to be able to map it back to our data.
                taskIdPromises.push(this.addCustomExecution(taskDTO, task, false));
              }
            }
          }
        }
        return {
          tasks: taskDTOs,
          extension: provider.extension,
        };
      })
      .catch((err) => {
        getDebugLogger().error(err, provider.extension);
        return {
          tasks: [],
          extension: provider.extension,
        };
      });

    return new Promise((resolve) => {
      fetching.then((result) => {
        Promise.all(taskIdPromises).then(() => {
          resolve(result);
        });
      });
    });
  }

  async $resolveTask(handle: number, taskDTO: TaskDto): Promise<TaskDTO | undefined> {
    const taskDto = toTask(taskDTO);
    const handler = this.taskHandlers.get(handle);
    if (!handler) {
      return Promise.reject(new Error('no handler found!'));
    }

    const resolvedTask = await handler.provider.resolveTask(taskDto, CancellationToken.None);
    if (!resolvedTask) {
      return;
    }

    const resolvedTaskDTO: TaskDTO | undefined = TaskDTO.from(resolvedTask, handler.extension);
    if (!resolvedTaskDTO) {
      throw new Error('Unexpected: Task cannot be resolved.');
    }

    if (CustomExecutionDTO.is(resolvedTaskDTO.execution)) {
      await this.addCustomExecution(resolvedTaskDTO, resolvedTask, true);
    }

    return resolvedTaskDTO;
  }
}

export function createTaskApiFactory(extHostTasks: IExtHostTasks, extension): typeof vscode.tasks {
  return {
    registerTaskProvider: (type: string, provider: TaskProvider) =>
      extHostTasks.registerTaskProvider(type, provider, extension),
    fetchTasks(filter?: TaskFilter): Promise<Task[]> {
      return extHostTasks.fetchTasks(filter);
    },
    executeTask: (task) => extHostTasks.executeTask(task, extension),
    get taskExecutions(): ReadonlyArray<TaskExecution> {
      return extHostTasks.taskExecutions;
    },
    onDidStartTask: (listener, thisArg?, disposables?) => extHostTasks.onDidStartTask(listener, thisArg, disposables),
    onDidEndTask(listener, thisArg?, disposables?) {
      return extHostTasks.onDidEndTask(listener, thisArg, disposables);
    },
    onDidStartTaskProcess(listener, thisArg?, disposables?) {
      return extHostTasks.onDidStartTaskProcess(listener, thisArg, disposables);
    },
    onDidEndTaskProcess(listener, thisArg?, disposables?) {
      return extHostTasks.onDidEndTaskProcess(listener, thisArg, disposables);
    },
  };
}
