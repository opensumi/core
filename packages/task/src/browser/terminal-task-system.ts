import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import {
  Event,
  formatLocalize,
  IProblemMatcherRegistry,
  Disposable,
  Deferred,
  ProblemMatcher,
  isString,
  deepClone,
  removeAnsiEscapeCodes,
  Emitter,
  DisposableCollection,
  ProblemMatch,
  ProblemMatchData,
} from '@opensumi/ide-core-common';
import { Path } from '@opensumi/ide-core-common/lib/path';
import {
  TerminalOptions,
  ITerminalController,
  ITerminalGroupViewService,
  ITerminalClient,
  ITerminalService,
} from '@opensumi/ide-terminal-next/lib/common';
import { IVariableResolverService } from '@opensumi/ide-variable';

import {
  ITaskSystem,
  ITaskExecuteResult,
  ITaskExecutor,
  TaskExecuteKind,
  IActivateTaskExecutorData,
  TaskTerminateResponse,
} from '../common';
import {
  Task,
  ContributedTask,
  CommandString,
  CommandConfiguration,
  TaskEvent,
  TaskEventKind,
  RuntimeType,
} from '../common/task';
import { CustomTask } from '../common/task';


import { ProblemCollector } from './problem-collector';


enum TaskStatus {
  PROCESS_INIT,
  PROCESS_READY,
  PROCESS_RUNNING,
  PROCESS_EXITED,
}

function rangeAreEqual(a, b) {
  return (
    a.start.line === b.start.line &&
    a.start.character === b.start.character &&
    a.end.line === b.end.line &&
    a.end.character === b.end.character
  );
}

function problemAreEquals(a: ProblemMatchData | ProblemMatch, b: ProblemMatchData | ProblemMatch) {
  return (
    a.resource?.toString() === b.resource?.toString() &&
    a.description.owner === b.description.owner &&
    a.description.severity === b.description.severity &&
    a.description.source === b.description.source &&
    (a as ProblemMatchData)?.marker.code === (b as ProblemMatchData)?.marker.code &&
    (a as ProblemMatchData)?.marker.message === (b as ProblemMatchData)?.marker.message &&
    (a as ProblemMatchData)?.marker.source === (b as ProblemMatchData)?.marker.source &&
    rangeAreEqual((a as ProblemMatchData).marker.range, (b as ProblemMatchData).marker.range)
  );
}

@Injectable({ multiple: true })
export class TerminalTaskExecutor extends Disposable implements ITaskExecutor {
  @Autowired(ITerminalGroupViewService)
  protected readonly terminalView: ITerminalGroupViewService;

  @Autowired(ITerminalController)
  protected readonly terminalController: ITerminalController;

  @Autowired(ITerminalService)
  protected readonly terminalService: ITerminalService;

  private terminalClient: ITerminalClient | undefined;

  private pid: number | undefined;

  private exitDefer: Deferred<{ exitCode?: number }> = new Deferred();

  private _onDidTerminalCreated: Emitter<string> = new Emitter();

  private _onDidTaskProcessExit: Emitter<number | undefined> = new Emitter();

  private _onDidBackgroundTaskBegin: Emitter<void> = new Emitter();
  public onDidBackgroundTaskBegin: Event<void> = this._onDidBackgroundTaskBegin.event;

  private _onDidBackgroundTaskEnd: Emitter<void> = new Emitter();
  public onDidBackgroundTaskEnd: Event<void> = this._onDidBackgroundTaskEnd.event;

  private _onDidProblemMatched: Emitter<ProblemMatch[]> = new Emitter();
  public onDidProblemMatched: Event<ProblemMatch[]> = this._onDidProblemMatched.event;

  private _onDidTerminalWidgetRemove: Emitter<void> = new Emitter();

  public onDidTerminalCreated: Event<string> = this._onDidTerminalCreated.event;

  public onDidTerminalWidgetRemove: Event<void> = this._onDidTerminalWidgetRemove.event;

  public onDidTaskProcessExit: Event<number | undefined> = this._onDidTaskProcessExit.event;

  public processReady: Deferred<void> = new Deferred<void>();

  private processExited = false;

  private disposableCollection: DisposableCollection = new DisposableCollection();

  public taskStatus: TaskStatus = TaskStatus.PROCESS_INIT;

  constructor(
    private terminalOptions: TerminalOptions,
    private collector: ProblemCollector,
    public executorId: number,
  ) {
    super();

    this.addDispose(
      this.terminalView.onWidgetDisposed((e) => {
        if (this.terminalClient && e.id === this.terminalClient.id) {
          this._onDidTerminalWidgetRemove.fire();
        }
      }),
    );
  }

  terminate(): Promise<{ success: boolean }> {
    return new Promise((resolve) => {
      if (this.terminalClient) {
        this.terminalClient.dispose();
        if (this.processExited) {
          // 如果在调 terminate 之前进程已经退出，直接删掉 terminalWidget 即可
          this.terminalView.removeWidget(this.terminalClient.id);
          resolve({ success: true });
        } else {
          this.terminalService.onExit((e) => {
            if (e.sessionId === this.terminalClient?.id) {
              this.terminalView.removeWidget(this.terminalClient.id);
              resolve({ success: true });
            }
          });
        }
      } else {
        resolve({ success: true });
      }
    });
  }

  private onTaskExit(code?: number) {
    const { term, id } = this.terminalClient!;
    term.setOption('disableStdin', true);
    term.writeln(formatLocalize('terminal.integrated.exitedWithCode', code));
    term.writeln(`\r\n\x1b[1m${formatLocalize('reuseTerminal')}\x1b[0m`);
    this._onDidTaskProcessExit.fire(code);
    this.disposableCollection.push(
      term.onKey(() => {
        this.terminalView.removeWidget(id);
      }),
    );
  }

  private async createTerminal(reuse?: boolean) {
    if (reuse && this.terminalClient) {
      this.terminalClient.updateOptions(this.terminalOptions);
      this.terminalClient.reset();
    } else {
      this.terminalClient = await this.terminalController.createClientWithWidget2({
        terminalOptions: this.terminalOptions,
        closeWhenExited: false,
        beforeCreate: (terminalId) => {
          this._onDidTerminalCreated.fire(terminalId);
        },
      });
    }

    this.terminalController.showTerminalPanel();

    this.addDispose(
      this.terminalClient.onOutput((e) => {
        const output = removeAnsiEscapeCodes(e.data.toString());
        const isBegin = this.collector.matchBeginMatcher(output);
        if (isBegin) {
          this._onDidBackgroundTaskBegin.fire();
        }

        // process multi-line output
        const lines = output.split(/\r?\n/g).filter((e) => e);
        const markerResults: ProblemMatch[] = [];
        for (const l of lines) {
          const markers = this.collector.processLine(l);
          if (markers && markers.length > 0) {
            for (const marker of markers) {
              const existing = markerResults.findIndex((e) => problemAreEquals(e, marker));
              if (existing === -1) {
                markerResults.push(marker);
              }
            }
          }
        }

        if (markerResults.length > 0) {
          this._onDidProblemMatched.fire(markerResults);
        }

        const isEnd = this.collector.matchEndMatcher(output);
        if (isEnd) {
          this._onDidBackgroundTaskEnd.fire();
        }
      }),
    );

    this.disposableCollection.push(
      this.terminalClient.onExit(async (e) => {
        if (e.id === this.terminalClient?.id) {
          this.onTaskExit(e.code);
          this.processExited = true;
          this.taskStatus = TaskStatus.PROCESS_EXITED;
          this.exitDefer.resolve({ exitCode: e.code });
        }
      }),
    );

    this.disposableCollection.push(
      this.terminalService.onExit(async (e) => {
        if (e.sessionId === this.terminalClient?.id) {
          await this.processReady.promise;
          this.onTaskExit(e.code);
          this.processExited = true;
          this.taskStatus = TaskStatus.PROCESS_EXITED;
          this.exitDefer.resolve({ exitCode: e.code });
        }
      }),
    );
  }

  async execute(task: Task, reuse?: boolean): Promise<{ exitCode?: number }> {
    this.taskStatus = TaskStatus.PROCESS_READY;

    await this.createTerminal(reuse);

    this.terminalClient?.term.writeln(`\x1b[1m> Executing task: ${task._label} <\x1b[0m\n`);
    const { shellArgs } = this.terminalOptions;

    // extensionTerminal 由插件自身接管，不需要执行和输出 Command
    if (!this.terminalOptions.isExtensionTerminal && shellArgs) {
      this.terminalClient?.term.writeln(
        `\x1b[1m> Command: ${typeof shellArgs === 'string' ? shellArgs : shellArgs[1]} <\x1b[0m\n`,
      );
    }

    await this.terminalClient?.attached.promise;
    this.taskStatus = TaskStatus.PROCESS_RUNNING;
    this.pid = await this.terminalClient?.pid;
    this.processReady.resolve();
    this.terminalView.selectWidget(this.terminalClient!.id);
    this.terminalClient?.term.write('\n\x1b[G');
    return this.exitDefer.promise;
  }

  get processId(): number | undefined {
    return this.pid;
  }

  get terminalId(): string | undefined {
    return this.terminalClient && this.terminalClient.id;
  }

  get widgetId(): string | undefined {
    return this.terminalClient && this.terminalClient.widget.id;
  }

  public updateTerminalOptions(terminalOptions: TerminalOptions) {
    this.terminalOptions = terminalOptions;
  }

  public updateProblemCollector(collector: ProblemCollector) {
    this.collector = collector;
  }

  public reset() {
    this.disposableCollection.dispose();
    this.taskStatus = TaskStatus.PROCESS_INIT;
    this.exitDefer = new Deferred();
  }
}

@Injectable()
export class TerminalTaskSystem extends Disposable implements ITaskSystem {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(IProblemMatcherRegistry)
  problemMatcher: IProblemMatcherRegistry;

  @Autowired(IVariableResolverService)
  variableResolver: IVariableResolverService;

  private executorId = 0;

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
    return { shellArgs: ['-c', `${result.join(' ')}`] };
  }

  private findAvailableExecutor(): TerminalTaskExecutor | undefined {
    return this.taskExecutors.find((e) => e.taskStatus === TaskStatus.PROCESS_EXITED);
  }

  private async executeTask(task: CustomTask | ContributedTask): Promise<ITaskExecuteResult> {
    // CustomExecution
    const isCustomExecution = task.command && task.command.runtime === RuntimeType.CustomExecution;

    const matchers = await this.resolveMatchers(task.configurationProperties.problemMatchers);
    const collector = new ProblemCollector(matchers);
    const { shellArgs } = await this.buildShellConfig(task.command);

    const terminalOptions: TerminalOptions = {
      name: this.createTerminalName(task),
      shellArgs,
      isExtensionTerminal: isCustomExecution,
      env: task.command.options?.env || {},
      cwd: task.command.options?.cwd
        ? await this.resolveVariable(task.command.options?.cwd)
        : await this.resolveVariable('${workspaceFolder}'),
    };

    let executor: TerminalTaskExecutor | undefined = this.findAvailableExecutor();
    let reuse = false;
    if (!executor) {
      executor = this.injector.get(TerminalTaskExecutor, [terminalOptions, collector, this.executorId]);
      this.executorId += 1;
      this.taskExecutors.push(executor);
      this.addDispose(
        executor.onDidTerminalWidgetRemove(() => {
          this.taskExecutors = this.taskExecutors.filter((t) => t.executorId !== executor!.executorId);
        }),
      );
    } else {
      reuse = true;
      executor.updateProblemCollector(collector);
      executor.updateTerminalOptions(terminalOptions);
      executor.reset();
    }

    if (reuse) {
      // 插件进程中 CustomExecution 会等待前台终端实例创建完成后进行 attach
      // 重用终端的情况下，要再次发出事件确保 attach 成功 (ext.host.task.ts#$onDidStartTask)
      this._onDidStateChange.fire(TaskEvent.create(TaskEventKind.Start, task, executor.terminalId));
    } else {
      this.addDispose(
        executor.onDidTerminalCreated((terminalId) => {
          // 当 task 使用 CustomExecution 时，发出 TaskEventKind.Start 事件后，插件进程将尝试 attach 这个 Pseudoterminal (ext.host.task.ts#$onDidStartTask)
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

  rerun(): import('../common').ITaskExecuteResult | undefined {
    throw new Error('Method not implemented.');
  }
  isActive(): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  isActiveSync(): boolean {
    throw new Error('Method not implemented.');
  }

  getBusyTasks(): import('../common/task').Task[] {
    throw new Error('Method not implemented.');
  }
  canAutoTerminate(): boolean {
    throw new Error('Method not implemented.');
  }

  terminateAll(): Promise<import('../common').TaskTerminateResponse[]> {
    throw new Error('Method not implemented.');
  }
  revealTask(task: import('../common/task').Task): boolean {
    throw new Error('Method not implemented.');
  }
  customExecutionComplete(task: import('../common/task').Task, result: number): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
