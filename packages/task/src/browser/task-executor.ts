import { Injectable, Autowired } from '@opensumi/di';
import {
  Event,
  formatLocalize,
  Disposable,
  Deferred,
  strings,
  Emitter,
  DisposableCollection,
  ProblemMatch,
  ProblemMatchData,
} from '@opensumi/ide-core-common';
import {
  TerminalOptions,
  ITerminalController,
  ITerminalGroupViewService,
  ITerminalClient,
  ITerminalService,
} from '@opensumi/ide-terminal-next/lib/common';

import { ITaskExecutor } from '../common';
import { Task } from '../common/task';

import { ProblemCollector } from './problem-collector';

const { removeAnsiEscapeCodes } = strings;

export enum TaskStatus {
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
  public onDidTerminalCreated: Event<string> = this._onDidTerminalCreated.event;

  private _onDidTaskProcessExit: Emitter<number | undefined> = new Emitter();
  public onDidTaskProcessExit: Event<number | undefined> = this._onDidTaskProcessExit.event;

  private _onDidBackgroundTaskBegin: Emitter<void> = new Emitter();
  public onDidBackgroundTaskBegin: Event<void> = this._onDidBackgroundTaskBegin.event;

  private _onDidBackgroundTaskEnd: Emitter<void> = new Emitter();
  public onDidBackgroundTaskEnd: Event<void> = this._onDidBackgroundTaskEnd.event;

  private _onDidProblemMatched: Emitter<ProblemMatch[]> = new Emitter();
  public onDidProblemMatched: Event<ProblemMatch[]> = this._onDidProblemMatched.event;

  private _onDidTerminalWidgetRemove: Emitter<void> = new Emitter();
  public onDidTerminalWidgetRemove: Event<void> = this._onDidTerminalWidgetRemove.event;

  public processReady: Deferred<void> = new Deferred<void>();

  private processExited = false;

  private eventToDispose: DisposableCollection = new DisposableCollection();

  public taskStatus: TaskStatus = TaskStatus.PROCESS_INIT;

  constructor(
    private task: Task,
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
    if (!this.terminalClient) {
      return;
    }
    const { term, id } = this.terminalClient;
    term.options.disableStdin = true;
    term.writeln(`\r\n${formatLocalize('terminal.integrated.exitedWithCode', code)}`);
    term.writeln(`\r\n\x1b[1m${formatLocalize('reuseTerminal')}\x1b[0m`);
    this._onDidTaskProcessExit.fire(code);
    this.eventToDispose.push(
      term.onKey((data) => {
        const key = data.key;
        if (key.toLowerCase() === 'r') {
          // rerun the task
          // this.reset();
        }
        this.terminalView.removeWidget(id);
      }),
    );
  }

  /**
   * 监听 Terminal 的相关事件，一个 Executor 仅需监听一次即可，否则多次监听会导致输出重复内容。
   * 注意里面的 event 用完要及时 dispose
   */
  private bindTerminalClientEvent() {
    if (!this.terminalClient) {
      return;
    }
    this.eventToDispose.dispose();

    this.eventToDispose.push(
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

    this.eventToDispose.push(
      this.terminalClient.onExit(async (e) => {
        if (e.id === this.terminalClient?.id && this.taskStatus !== TaskStatus.PROCESS_EXITED) {
          this.taskStatus = TaskStatus.PROCESS_EXITED;
          this.onTaskExit(e.code);
          this.processExited = true;
          this.exitDefer.resolve({ exitCode: e.code });
        }
      }),
    );

    this.eventToDispose.push(
      this.terminalService.onExit(async (e) => {
        if (e.sessionId === this.terminalClient?.id && this.taskStatus !== TaskStatus.PROCESS_EXITED) {
          this.taskStatus = TaskStatus.PROCESS_EXITED;
          await this.processReady.promise;
          this.onTaskExit(e.code);
          this.processExited = true;
          this.exitDefer.resolve({ exitCode: e.code });
        }
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
        isTaskExecutor: true,
        taskId: this.task._id,
        beforeCreate: (terminalId) => {
          this._onDidTerminalCreated.fire(terminalId);
        },
      });
    }
    this.bindTerminalClientEvent();
    this.terminalController.showTerminalPanel();
  }

  async attach(terminalClient: ITerminalClient): Promise<{ exitCode?: number }> {
    this.taskStatus = TaskStatus.PROCESS_READY;
    this.terminalClient = terminalClient;
    this.terminalOptions = terminalClient.options;
    this.bindTerminalClientEvent();
    this.taskStatus = TaskStatus.PROCESS_RUNNING;
    this.pid = await this.terminalClient?.pid;
    this.processReady.resolve();

    this._onDidTerminalCreated.fire(terminalClient.id);

    return this.exitDefer.promise;
  }

  async execute(task: Task, reuse?: boolean): Promise<{ exitCode?: number }> {
    this.taskStatus = TaskStatus.PROCESS_READY;

    await this.createTerminal(reuse);

    this.terminalClient?.term.writeln(`\x1b[3m> Executing task: ${task._label} <\x1b[0m\n`);
    const { shellArgs } = this.terminalOptions;

    // extensionTerminal 由插件自身接管，不需要执行和输出 Command
    if (!this.terminalOptions.isExtensionTerminal && shellArgs) {
      this.terminalClient?.term.writeln(
        `\x1b[3m> Command: ${typeof shellArgs === 'string' ? shellArgs : shellArgs[1]} <\x1b[0m\n`,
      );
    }

    await this.terminalClient?.attached.promise;
    this.taskStatus = TaskStatus.PROCESS_RUNNING;
    this.pid = await this.terminalClient?.pid;
    this.processReady.resolve();
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
    this.eventToDispose.dispose();
    this.taskStatus = TaskStatus.PROCESS_INIT;
    this.exitDefer = new Deferred();
  }
}
