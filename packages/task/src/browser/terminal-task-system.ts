import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { Event, formatLocalize, IProblemMatcherRegistry, Disposable, Deferred, ProblemMatcher, isString, deepClone, removeAnsiEscapeCodes, Emitter } from '@ali/ide-core-common';

import { ITaskSystem, ITaskExecuteResult, ITaskExecutor, TaskExecuteKind, IActivateTaskExecutorData, TaskTerminateResponse } from '../common';
import { Task, ContributedTask, CommandString, CommandConfiguration, TaskEvent, TaskEventKind } from '../common/task';
import { TerminalOptions, ITerminalController, ITerminalGroupViewService, ITerminalClient, ITerminalExternalService } from '@ali/ide-terminal-next/lib/common';
import { CustomTask } from '../common/task';
import { IVariableResolverService } from '@ali/ide-variable';
import { ProblemCollector } from './problem-collector';
import { Path } from '@ali/ide-core-common/lib/path';

@Injectable({ multiple: true })
export class TerminalTaskExecutor extends Disposable implements ITaskExecutor {

  @Autowired(ITerminalGroupViewService)
  protected readonly terminalView: ITerminalGroupViewService;

  @Autowired(ITerminalController)
  protected readonly terminalController: ITerminalController;

  @Autowired(ITerminalExternalService)
  protected readonly terminalService: ITerminalExternalService;

  private terminalWidget: ITerminalClient;

  private exitDefer: Deferred<{ exitCode?: number }> = new Deferred();

  private _onDidTaskProcessExit: Emitter<number | undefined> = new Emitter();

  public onDidTaskProcessExit: Event<number | undefined> = this._onDidTaskProcessExit.event;

  public processReady: Deferred<void> = new Deferred<void>();

  constructor(private terminalOptions: TerminalOptions, private collector: ProblemCollector) {
    super();
    this.terminalWidget = this.terminalController.createClientWithWidget({ ...terminalOptions, closeWhenExited: false });
    this.terminalController.showTerminalPanel();

    this.addDispose(this.terminalWidget.onReceivePtyMessage((e) => {
      this.collector.processLine(removeAnsiEscapeCodes(e.message));
    }));

    this.addDispose(this.terminalService.onExit((e) => {
      if (e.sessionId === this.terminalWidget.id) {
        this.onTaskExit(e.code);
        this.exitDefer.resolve({ exitCode: e.code });
      }
    }));
  }

  terminate(): Promise<{ success: boolean }> {
    return new Promise((resolve, reject) => {
      if (this.terminalWidget) {
        this.terminalWidget.dispose();
        this.terminalService.onExit((e) => {
          if (e.sessionId === this.terminalWidget.id) {
            this.terminalView.removeWidget(this.terminalWidget.id);
            resolve({ success: true });
          }
        });
      } else {
        resolve({ success: true });
      }
    });
  }

  private onTaskExit(code?: number) {
    const { term, id } = this.terminalWidget;
    term.setOption('disableStdin', true);
    term.writeln(formatLocalize('terminal.integrated.exitedWithCode', code));
    term.writeln(`\r\n\x1b[1m${formatLocalize('reuseTerminal')}\x1b[0m`);
    this._onDidTaskProcessExit.fire(code);
    this.addDispose(term.onKey(() => {
      this.terminalView.removeWidget(id);
    }));
  }

  async execute(task: Task): Promise<{ exitCode?: number }> {
    await this.terminalWidget.attach();
    await this.terminalWidget.attached.promise;
    this.processReady.resolve();

    this.terminalWidget.term.writeln(`\x1b[1m> Executing task: ${task._label} <\x1b[0m\n`);
    const { shellPath, shellArgs } = this.terminalOptions;
    this.terminalWidget.term.writeln(`\x1b[1m> Command: ${shellPath} ${typeof shellArgs === 'string' ? shellArgs : shellArgs?.join(' ')} <\x1b[0m\n`);
    this.terminalView.selectWidget(this.terminalWidget.id);
    this.terminalWidget.term.write('\n\x1b[G');
    return this.exitDefer.promise;
  }

  get processId(): number {
    return this.terminalWidget.pid;
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

  private currentTask: Task;

  private activeTaskExecutors: Map<string, IActivateTaskExecutorData> = new Map();

  private _onDidStateChange: Emitter<TaskEvent> = new Emitter();

  onDidStateChange: Event<TaskEvent> = this._onDidStateChange.event;

  run(task: CustomTask | ContributedTask): Promise<ITaskExecuteResult> {
    this.currentTask = task;
    return this.executeTask(task);
  }

  private async buildShellConfig(command: CommandConfiguration) {
    const commandName = command.name;
    const commandArgs = command.args;
    let executable;
    const shellArgs: string[] = [];
    if (commandName) {
      if (typeof commandName === 'string') {
        const [exec, ...args] = commandName.split(' ');
        if (exec.indexOf(Path.separator) > -1) {
          executable = await this.resolveVariables(exec.split(Path.separator));
        } else {
          executable = await this.resolveVariable(exec);
        }
        shellArgs.push(...args);
      } else {
        // TODO
      }
    }
    if (commandArgs) {
      for (const arg of commandArgs) {
        if (typeof arg === 'string') {
          shellArgs.push(arg);
        }
      }
    }
    const result: string[] = [];
    for (const arg of shellArgs) {
      if (arg.indexOf(Path.separator) > -1) {
        result.push(await this.resolveVariables(arg.split(Path.separator)));
      } else {
        result.push(await this.resolveVariable(arg));
      }
    }
    return { executable, shellArgs: result };
  }

  private async executeTask(task: CustomTask | ContributedTask): Promise<ITaskExecuteResult> {
    this._onDidStateChange.fire(TaskEvent.create(TaskEventKind.Start, task));
    const matchers = await this.resolveMatchers(task.configurationProperties.problemMatchers);
    const collector = new ProblemCollector(matchers);
    const { executable, shellArgs } = await this.buildShellConfig(task.command);
    const terminalOptions: TerminalOptions = {
      name: this.createTerminalName(task),
      shellArgs,
      shellPath: executable,
      cwd: task.command.options?.cwd ? await this.resolveVariable(task.command.options?.cwd) : await this.resolveVariable('${workspaceFolder}'),
    };

    this._onDidStateChange.fire(TaskEvent.create(TaskEventKind.Active, task));
    const executor = this.injector.get(TerminalTaskExecutor, [terminalOptions, collector]);

    this.addDispose(executor.onDidTaskProcessExit((code) => {
      this._onDidStateChange.fire(TaskEvent.create(TaskEventKind.ProcessEnded, task, code));
      this._onDidStateChange.fire(TaskEvent.create(TaskEventKind.End, task));
    }));

    const result = executor.execute(task);

    const mapKey = task.getMapKey();
    this.activeTaskExecutors.set(mapKey, { promise: Promise.resolve(result), task, executor });

    await executor.processReady.promise;
    this._onDidStateChange.fire(TaskEvent.create(TaskEventKind.ProcessStarted, task, executor.processId));
    return {
      task,
      kind: TaskExecuteKind.Started,
      promise: Promise.resolve(result),
    };
  }

  private createTerminalName(task: CustomTask | ContributedTask): string {
    return formatLocalize('TerminalTaskSystem.terminalName', task.getQualifiedLabel() || task.configurationProperties.name);
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
    // TODO@Dirk Task.getWorkspaceFolder should return a WorkspaceFolder that is defined in workspace.ts
    if (isString(value)) {
      return await this.variableResolver.resolve<string>(value);
    } else if (value !== undefined) {
      return {
        value: await this.variableResolver.resolve<string>(value.value),
        quoting: value.quoting,
      };
    } else { // This should never happen
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
