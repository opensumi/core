import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import {
  Disposable,
  Emitter,
  Event,
  IProblemMatcherRegistry,
  ProblemMatcher,
  formatLocalize,
  isString,
  objects,
  path,
} from '@opensumi/ide-core-common';
import { IShellLaunchConfig, ITerminalClient } from '@opensumi/ide-terminal-next/lib/common';
import { IVariableResolverService } from '@opensumi/ide-variable';

import {
  IActivateTaskExecutorData,
  ITaskExecuteResult,
  ITaskSystem,
  TaskExecuteKind,
  TaskTerminateResponse,
} from '../common';
import {
  CommandConfiguration,
  CommandString,
  ContributedTask,
  CustomTask,
  RuntimeType,
  Task,
  TaskEvent,
  TaskEventKind,
} from '../common/task';

import { ProblemCollector } from './problem-collector';
import { TaskStatus, TerminalTaskExecutor } from './task-executor';

const { deepClone } = objects;
const { Path } = path;

@Injectable()
export class TerminalTaskSystem extends Disposable implements ITaskSystem {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(IProblemMatcherRegistry)
  problemMatcher: IProblemMatcherRegistry;

  @Autowired(IVariableResolverService)
  variableResolver: IVariableResolverService;

  private executorId = 0;

  private lastTask: CustomTask | ContributedTask | undefined;
  protected currentTask: Task;

  private activeTaskExecutors: Map<string, IActivateTaskExecutorData> = new Map();

  private _onDidStateChange: Emitter<TaskEvent> = new Emitter();

  private _onDidBackgroundTaskBegin: Emitter<TaskEvent> = new Emitter();

  private _onDidBackgroundTaskEnded: Emitter<TaskEvent> = new Emitter();

  private _onDidProblemMatched: Emitter<TaskEvent> = new Emitter();

  private taskExecutors: TerminalTaskExecutor[] = [];

  onDidStateChange: Event<TaskEvent> = this._onDidStateChange.event;
  onDidBackgroundTaskBegin: Event<TaskEvent> = this._onDidBackgroundTaskBegin.event;
  onDidBackgroundTaskEnded: Event<TaskEvent> = this._onDidBackgroundTaskEnded.event;
  onDidProblemMatched: Event<TaskEvent> = this._onDidProblemMatched.event;

  run(task: CustomTask | ContributedTask): Promise<ITaskExecuteResult> {
    this.currentTask = task;
    return this.executeTask(task);
  }

  attach(task: CustomTask | ContributedTask, terminalClient: ITerminalClient): Promise<ITaskExecuteResult> {
    this.currentTask = task;
    return this.attachTask(task, terminalClient);
  }

  private async buildShellConfig(command: CommandConfiguration) {
    let subCommand = '';
    const commandName = command.name;
    const commandArgs = command.args;
    const subArgs: string[] = [];
    const result: string[] = [];

    if (commandName) {
      if (typeof commandName === 'string') {
        subCommand = commandName;
      } else {
        subCommand = commandName.value;
      }
    }

    subArgs.push(subCommand);

    if (commandArgs) {
      for (const arg of commandArgs) {
        if (typeof arg === 'string') {
          subArgs.push(arg);
        } else {
          subArgs.push(arg.value);
        }
      }
    }

    for (const arg of subArgs) {
      if (arg.indexOf(Path.separator) > -1) {
        result.push(await this.resolveVariables(arg.split(Path.separator)));
      } else {
        result.push(await this.resolveVariable(arg));
      }
    }
    return { args: ['-c', `${result.join(' ')}`] };
  }

  private findAvailableExecutor(): TerminalTaskExecutor | undefined {
    return this.taskExecutors.find((e) => e.taskStatus === TaskStatus.PROCESS_EXITED);
  }

  private async createTaskExecutor(task: CustomTask | ContributedTask, launchConfig: IShellLaunchConfig) {
    const matchers = await this.resolveMatchers(task.configurationProperties.problemMatchers);
    const collector = new ProblemCollector(matchers);
    const executor = this.injector.get(TerminalTaskExecutor, [task, launchConfig, collector, this.executorId]);
    this.executorId += 1;
    this.taskExecutors.push(executor);
    this.addDispose(
      executor.onDidTerminalWidgetRemove(() => {
        this.taskExecutors = this.taskExecutors.filter((t) => t.executorId !== executor.executorId);
      }),
    );

    return executor;
  }

  private async attachTask(
    task: CustomTask | ContributedTask,
    terminalClient: ITerminalClient,
  ): Promise<ITaskExecuteResult> {
    const taskExecutor = await this.createTaskExecutor(task, terminalClient.launchConfig);
    const p = taskExecutor.attach(terminalClient);
    this.lastTask = task;
    return {
      task,
      kind: TaskExecuteKind.Started,
      promise: p,
    };
  }

  private async executeTask(task: CustomTask | ContributedTask): Promise<ITaskExecuteResult> {
    // CustomExecution
    const isCustomExecution = task.command && task.command.runtime === RuntimeType.CustomExecution;

    const matchers = await this.resolveMatchers(task.configurationProperties.problemMatchers);
    const collector = new ProblemCollector(matchers);
    const { args } = await this.buildShellConfig(task.command);

    const launchConfig: IShellLaunchConfig = {
      name: this.createTerminalName(task),
      args,
      isExtensionOwnedTerminal: isCustomExecution,
      env: task.command.options?.env || {},
      cwd: task.command.options?.cwd
        ? await this.resolveVariable(task.command.options?.cwd)
        : await this.resolveVariable('${workspaceFolder}'),
      // 不需要历史记录
      disablePreserveHistory: true,
    };

    let executor: TerminalTaskExecutor | undefined = this.findAvailableExecutor();
    let reuse = false;
    if (!executor) {
      executor = await this.createTaskExecutor(task, launchConfig);
    } else {
      reuse = true;
      executor.updateProblemCollector(collector);
      executor.updateLaunchConfig(launchConfig);
      executor.reset();
    }

    if (reuse) {
      // 插件进程中 CustomExecution 会等待前台终端实例创建完成后进行 attach
      // 重用终端的情况下，要再次发出事件确保 attach 成功 (ext.host.task.ts#$onDidStartTask)
      this._onDidStateChange.fire(TaskEvent.create(TaskEventKind.Start, task, executor.terminalId));
    } else {
      this.addDispose(
        executor.onDidTerminalCreated((terminalId) => {
          // 当 task 使用 CustomExecution 时，发出 TaskEventKind.Start 事件后
          // 插件进程将尝试 attach 这个 Pseudoterminal (ext.host.task.ts#$onDidStartTask)
          // attach 成功便会创建一个 ExtensionTerminal 实例
          // 确保后续调用 $startExtensionTerminal 时已经建立了连接
          this._onDidStateChange.fire(TaskEvent.create(TaskEventKind.Start, task, terminalId));
        }),
      );
    }

    if (!reuse) {
      this.addDispose(
        executor.onDidTaskProcessExit((code) => {
          this._onDidStateChange.fire(TaskEvent.create(TaskEventKind.ProcessEnded, task, code));
          this._onDidStateChange.fire(TaskEvent.create(TaskEventKind.End, task));
        }),
      );
      this.addDispose(
        executor.onDidBackgroundTaskBegin(() =>
          this._onDidBackgroundTaskBegin.fire(TaskEvent.create(TaskEventKind.BackgroundTaskBegin, task)),
        ),
      );
      this.addDispose(
        executor.onDidBackgroundTaskEnd(() =>
          this._onDidBackgroundTaskEnded.fire(TaskEvent.create(TaskEventKind.BackgroundTaskEnded, task)),
        ),
      );
      this.addDispose(
        executor.onDidProblemMatched((problems) =>
          this._onDidProblemMatched.fire(TaskEvent.create(TaskEventKind.ProblemMatched, task, problems)),
        ),
      );
    }

    const result = executor.execute(task, reuse);

    const mapKey = task.getMapKey();
    this.activeTaskExecutors.set(mapKey, { promise: Promise.resolve(result), task, executor });
    this._onDidStateChange.fire(TaskEvent.create(TaskEventKind.Active, task));
    await executor.processReady.promise;

    this._onDidStateChange.fire(TaskEvent.create(TaskEventKind.ProcessStarted, task, executor.processId));
    this.lastTask = task;
    return {
      task,
      kind: TaskExecuteKind.Started,
      promise: result,
    };
  }

  private createTerminalName(task: CustomTask | ContributedTask): string {
    return formatLocalize(
      'TerminalTaskSystem.terminalName',
      task.getQualifiedLabel() || task.configurationProperties.name,
    );
  }

  private async resolveVariables(value: string[]): Promise<string> {
    const result: string[] = [];
    for (const item of value) {
      result.push(await this.resolveVariable(item));
    }
    return result.join(Path.separator);
  }

  private async resolveVariable(value: string | undefined): Promise<string>;
  private async resolveVariable(value: CommandString | undefined): Promise<CommandString>;
  private async resolveVariable(value: CommandString | undefined): Promise<CommandString> {
    if (isString(value)) {
      return await this.variableResolver.resolve<string>(value);
    } else if (value !== undefined) {
      return {
        value: await this.variableResolver.resolve<string>(value.value),
        quoting: value.quoting,
      };
    } else {
      // This should never happen
      throw new Error('Should never try to resolve undefined.');
    }
  }

  private async resolveMatchers(values: Array<string | ProblemMatcher> | undefined): Promise<ProblemMatcher[]> {
    if (values === undefined || values === null || values.length === 0) {
      return [];
    }
    const result: ProblemMatcher[] = [];
    for (const value of values) {
      let matcher: ProblemMatcher | undefined;
      if (isString(value)) {
        if (value[0].startsWith('$')) {
          matcher = this.problemMatcher.get(value.substring(1));
        } else {
          matcher = this.problemMatcher.get(value);
        }
      } else {
        matcher = value;
      }
      if (!matcher) {
        continue;
      }
      const hasFilePrefix = matcher.filePrefix !== undefined;
      if (!hasFilePrefix) {
        result.push(matcher);
      } else {
        const copy = deepClone(matcher);
        if (hasFilePrefix) {
          copy.filePrefix = await this.resolveVariable(copy.filePrefix);
        }
        result.push(copy);
      }
    }
    return result;
  }
  getActiveTasks(): Task[] {
    return Array.from(this.activeTaskExecutors.values()).map((e) => e.task);
  }
  async terminate(task: Task): Promise<TaskTerminateResponse> {
    const key = task.getMapKey();
    const activeExecutor = this.activeTaskExecutors.get(key);
    if (!activeExecutor) {
      return Promise.resolve({ task: undefined, success: true });
    }
    const { success } = await activeExecutor.executor.terminate();
    this.activeTaskExecutors.delete(key);
    return { task, success };
  }
  async rerun(): Promise<ITaskExecuteResult | undefined> {
    return this.lastTask && (await this.executeTask(this.lastTask));
  }
  isActive(): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  isActiveSync(): boolean {
    throw new Error('Method not implemented.');
  }
  getBusyTasks(): Task[] {
    throw new Error('Method not implemented.');
  }
  canAutoTerminate(): boolean {
    throw new Error('Method not implemented.');
  }
  terminateAll(): Promise<TaskTerminateResponse[]> {
    throw new Error('Method not implemented.');
  }
  revealTask(task: Task): boolean {
    throw new Error('Method not implemented.');
  }
  customExecutionComplete(task: Task, result: number): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
