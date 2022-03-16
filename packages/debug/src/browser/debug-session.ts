import debounce = require('lodash.debounce');

import {
  Emitter,
  Event,
  URI,
  DisposableCollection,
  Deferred,
  IDisposable,
  IPosition,
  Mutable,
  canceled,
} from '@opensumi/ide-core-browser';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { CancellationTokenSource, CancellationToken, Disposable } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { IMessageService } from '@opensumi/ide-overlay';
import { ITerminalApiService, TerminalOptions } from '@opensumi/ide-terminal-next';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol';

import {
  DebugSessionOptions,
  IDebugSessionDTO,
  IDebugSession,
  IDebugSessionManager,
  DEBUG_REPORT_NAME,
  DebugState,
  DebugEventTypes,
  DebugRequestTypes,
  DebugExitEvent,
  IRuntimeBreakpoint,
  BreakpointsChangeEvent,
  IDebugBreakpoint,
} from '../common';
import { DebugConfiguration } from '../common';

import { DebugEditor } from './../common/debug-editor';
import { IDebugModel } from './../common/debug-model';
import { BreakpointManager, DebugBreakpoint } from './breakpoint';
import { DebugSessionConnection } from './debug-session-connection';
import { DebugModelManager } from './editor/debug-model-manager';
import { DebugSource } from './model/debug-source';
import { DebugStackFrame } from './model/debug-stack-frame';
import { StoppedDetails, DebugThread, DebugThreadData } from './model/debug-thread';
import { ExpressionContainer } from './tree/debug-tree-node.define';

export class DebugSession implements IDebugSession {
  protected readonly onDidChangeEmitter = new Emitter<void>();
  readonly onDidChange: Event<void> = this.onDidChangeEmitter.event;
  public fireDidChange(): void {
    this.onDidChangeEmitter.fire(undefined);
    this.onStateChange();
  }

  private readonly _onDidChangeCallStack = new Emitter<void>();
  readonly onDidChangeCallStack: Event<void> = this._onDidChangeCallStack.event;

  private readonly _onVariableChange = new Emitter<void>();
  readonly onVariableChange: Event<void> = this._onVariableChange.event;

  private readonly _onCurrentThreadChange = new Emitter<DebugThread | undefined>();
  readonly onCurrentThreadChange: Event<DebugThread | undefined> = this._onCurrentThreadChange.event;

  private readonly _onDidStop = new Emitter<DebugProtocol.StoppedEvent>();
  readonly onDidStop: Event<DebugProtocol.StoppedEvent> = this._onDidStop.event;

  private readonly _onDidContinued = new Emitter<DebugProtocol.ContinuedEvent>();
  readonly onDidContinued: Event<DebugProtocol.ContinuedEvent> = this._onDidContinued.event;

  private readonly _onDidThread = new Emitter<DebugProtocol.ThreadEvent>();
  readonly onDidThread: Event<DebugProtocol.ThreadEvent> = this._onDidThread.event;

  private readonly _onRequest = new Emitter<keyof DebugRequestTypes>();
  readonly onRequest: Event<keyof DebugRequestTypes> = this._onRequest.event;

  private readonly _onDidExitAdapter = new Emitter<void>();
  readonly onDidExitAdapter: Event<void> = this._onDidExitAdapter.event;

  private readonly _onDidProgressStart = new Emitter<DebugProtocol.ProgressStartEvent>();
  readonly onDidProgressStart: Event<DebugProtocol.ProgressStartEvent> = this._onDidProgressStart.event;

  private readonly _onDidProgressUpdate = new Emitter<DebugProtocol.ProgressUpdateEvent>();
  readonly onDidProgressUpdate: Event<DebugProtocol.ProgressUpdateEvent> = this._onDidProgressUpdate.event;

  private readonly _onDidProgressEnd = new Emitter<DebugProtocol.ProgressEndEvent>();
  readonly onDidProgressEnd: Event<DebugProtocol.ProgressEndEvent> = this._onDidProgressEnd.event;

  private readonly _onDidInvalidated = new Emitter<DebugProtocol.InvalidatedEvent>();
  readonly onDidInvalidated: Event<DebugProtocol.InvalidatedEvent> = this._onDidInvalidated.event;

  private readonly _onDidChangeState = new Emitter<DebugState>();
  readonly onDidChangeState: Event<DebugState> = this._onDidChangeState.event;

  protected readonly toDispose = new DisposableCollection();

  protected _capabilities: DebugProtocol.Capabilities = {};

  get capabilities(): DebugProtocol.Capabilities {
    return this._capabilities;
  }

  get supportsThreadIdCorrespond(): boolean {
    return !!this.capabilities.supportsThreadIdCorrespond;
  }

  protected updateDeffered: Deferred<void> | null = null;

  protected exitDeferred = new Deferred<DebugExitEvent>();

  protected cancellationMap = new Map<number, CancellationTokenSource[]>();
  protected readonly toDisposeOnCurrentThread = new DisposableCollection();
  protected previousState: DebugState | undefined;
  protected stoppedDetails: StoppedDetails | undefined;

  constructor(
    readonly id: string,
    readonly options: DebugSessionOptions,
    protected readonly connection: DebugSessionConnection,
    protected readonly terminalService: ITerminalApiService,
    protected readonly workbenchEditorService: WorkbenchEditorService,
    protected readonly breakpointManager: BreakpointManager,
    protected readonly modelManager: DebugModelManager,
    protected readonly labelProvider: LabelService,
    protected readonly messages: IMessageService,
    protected readonly fileSystem: IFileServiceClient,
    protected readonly sessionManager: IDebugSessionManager,
  ) {
    this.connection.onRequest('runInTerminal', (request: DebugProtocol.RunInTerminalRequest) => {
      this.runInTerminal(request);
    });

    this.toDispose.pushAll([
      this.onDidChangeEmitter,
      this.connection,
      // 返回调试配置
      this.on('initialized', () => {
        this.configure();
      }),
      // 更新断点
      this.on('breakpoint', ({ body }) => this.onUpdateBreakpoint(body)),
      this.on('continued', async (event: DebugProtocol.ContinuedEvent) => {
        const {
          body: { allThreadsContinued, threadId },
        } = event;
        this.handleCancellation(threadId);
        if (this.supportsThreadIdCorrespond) {
          if (threadId) {
            this._multipleThreadPaused.delete(threadId);
          } else if (allThreadsContinued !== false) {
            this._multipleThreadPaused.clear();
          }
          await this.updateCurrentThread();
          this._onDidContinued.fire(event);
          return;
        }

        // 更新线程
        if (allThreadsContinued !== false) {
          this.clearThreads();
          this._onDidContinued.fire(event);
          return;
        }

        if (threadId) {
          this.clearThread(threadId);
        }

        this.onStateChange();
        this._onDidContinued.fire(event);
      }),
      this.on('stopped', async (event: DebugProtocol.StoppedEvent) => {
        const { body } = event;
        this.stoppedDetails = body;

        const { threadId } = body;
        const reportTime = this.sessionManager.reportTime(DEBUG_REPORT_NAME.DEBUG_STOPPED, {
          sessionId: this.id,
          threadId,
        });

        if (this.supportsThreadIdCorrespond === true) {
          await this.collectPausedThread(body);
          if (body.threadId && this._multipleThreadPaused.has(body.threadId)) {
            const pauseThread = this._multipleThreadPaused.get(body.threadId);
            await this.updateCurrentThread(pauseThread);
            await this.updateCurrentThreadFramesOnFocus();
          }
        } else {
          this.updateDeffered = new Deferred();
          await this.updateThreads(body);
          await this.updateCurrentThreadFramesOnFocus();
          this.updateDeffered.resolve();
        }

        reportTime('stopped');
        // action 结束后需要清除
        const extra = this.sessionManager.getExtra(this.id, threadId);
        if (threadId && extra && extra.action) {
          extra.action = undefined;
          this.sessionManager.setExtra(this.id, `${threadId ?? ''}`, extra);
        }

        this.onStateChange();
        this._onDidStop.fire(event);
      }),
      this.on('thread', (event: DebugProtocol.ThreadEvent) => {
        const {
          body: { reason, threadId },
        } = event;

        if (this.supportsThreadIdCorrespond) {
          // 当 supportsThreadIdCorrespond 开启的时候，只有在 DebugState 为 Stopped 的时候才发送 thread dap 事件
          if (this.state === DebugState.Stopped) {
            this._onDidThread.fire(event);
          }
          return;
        }

        if (reason === 'started') {
          // 队列更新线程
          this.scheduleUpdateThreads();
        } else if (reason === 'exited') {
          // 清理线程数据
          this.clearThread(threadId);
        }
        this._onDidThread.fire(event);
      }),
      this.on('terminated', () => {
        this.terminated = true;
      }),
      this.on('exited', (reason) => {
        this.exitDeferred.resolve(reason);
      }),
      this.on('progressStart', (event: DebugProtocol.ProgressStartEvent) => {
        this._onDidProgressStart.fire(event);
      }),
      this.on('progressUpdate', (event: DebugProtocol.ProgressUpdateEvent) => {
        this._onDidProgressUpdate.fire(event);
      }),
      this.on('progressEnd', (event: DebugProtocol.ProgressEndEvent) => {
        this._onDidProgressEnd.fire(event);
      }),
      this.on('invalidated', async (event: DebugProtocol.InvalidatedEvent) => {
        this._onDidInvalidated.fire(event);

        if (
          !(
            event.body.areas &&
            event.body.areas.length === 1 &&
            (event.body.areas[0] === 'variables' || event.body.areas[0] === 'watch')
          )
        ) {
          this.cancelAllRequests();
          this.clearThreads();
          await this.updateThreads(this.stoppedDetails);
        }

        this.fireDidChange();
      }),
      this.on('capabilities', (event) => this.updateCapabilities(event.body.capabilities)),
      this.breakpointManager.onDidChangeBreakpoints((event) => this.runtimeUpdateBreakpoint(event)),
      this.breakpointManager.onDidChangeExceptionsBreakpoints((args) => {
        if (this.breakpointManager.breakpointsEnabled) {
          this.setExceptionBreakpoints(args);
        }
      }),
      Disposable.create(() => {
        // 清除断点的运行时状态
        this.breakpointManager.clearAllStatus(this.id);
      }),
    ]);
  }

  get configuration(): DebugConfiguration {
    return this.options.configuration;
  }

  get parentSession(): IDebugSession | undefined {
    return this.options.parentSession;
  }

  get lifecycleManagedByParent(): boolean | undefined {
    return this.options.lifecycleManagedByParent;
  }

  get compact(): boolean {
    return !!this.options.compact;
  }

  async start(): Promise<void> {
    await this.workbenchEditorService.saveAll();
    await this.initialize();
    await this.launchOrAttach();
  }

  protected async runInTerminal({
    arguments: { title, cwd, args, env },
  }: DebugProtocol.RunInTerminalRequest): Promise<DebugProtocol.RunInTerminalResponse['body']> {
    return this.doRunInTerminal({ name: title, cwd, env }, args.join(' '));
  }

  protected async doRunInTerminal(
    options: TerminalOptions,
    command?: string,
  ): Promise<DebugProtocol.RunInTerminalResponse['body']> {
    const activeTerminal = this.terminalService.terminals.find(
      (terminal) => terminal.name === options.name && terminal.isActive,
    );
    let processId: number | undefined;
    // 当存在同名终端并且处于激活状态时，复用该终端
    if (activeTerminal) {
      if (command) {
        this.terminalService.sendText(activeTerminal.id, command);
      }
      processId = await this.terminalService.getProcessId(activeTerminal.id);
    } else {
      const terminal = await this.terminalService.createTerminal(options);
      terminal.show();
      if (command) {
        this.terminalService.sendText(terminal.id, command);
        processId = await this.terminalService.getProcessId(terminal.id);
      }
    }
    return { processId };
  }

  protected async initialize(): Promise<void> {
    const response = await this.connection.sendRequest(
      'initialize',
      {
        clientID: 'OpenSumi',
        clientName: 'OpenSumi IDE',
        adapterID: this.configuration.type,
        locale: 'en-US',
        linesStartAt1: true,
        columnsStartAt1: true,
        pathFormat: 'path',
        supportsVariableType: false,
        supportsVariablePaging: false,
        supportsRunInTerminalRequest: true,
        supportsProgressReporting: true,
        supportsInvalidatedEvent: true,
      },
      this.configuration,
    );
    this.updateCapabilities(response.body || {});
    this.onStateChange();
  }
  protected async launchOrAttach(): Promise<void> {
    if (this.parentSession && this.parentSession.state === DebugState.Inactive) {
      throw canceled();
    }

    try {
      if (this.configuration.request === 'attach') {
        await this.sendRequest('attach', this.configuration);
      } else {
        await this.sendRequest('launch', this.configuration);
      }
    } catch (reason) {
      this.fireExited(reason);
      this.messages.error(reason.message || 'Debug session initialization failed. See console for details.');
      throw reason && reason.message;
    }
  }
  protected initialized = false;

  protected async configure(): Promise<void> {
    await this.initBreakpoints();
    // 更新exceptionBreakpoint配置
    this.breakpointManager.setExceptionBreakpoints(this.capabilities.exceptionBreakpointFilters || []);
    if (this.capabilities.supportsConfigurationDoneRequest) {
      await this.sendRequest('configurationDone', {});
    }
    this.initialized = true;
    if (!this.supportsThreadIdCorrespond) {
      await this.updateThreads(undefined);
    }
  }

  protected async setExceptionBreakpoints(
    args: DebugProtocol.SetExceptionBreakpointsArguments,
  ): Promise<DebugProtocol.SetExceptionBreakpointsResponse> {
    return this.sendRequest('setExceptionBreakpoints', args);
  }

  protected onStateChange(): void {
    const state = this.state;
    if (this.previousState !== state) {
      this.previousState = state;
      this._onDidChangeState.fire(state);
    }
  }

  /**
   * runtime 时候的临时缓存，每次调试的时候都应该清空，
   * 会等待首次初始化完成
   */
  protected id2Breakpoint = new Map<number, IDebugBreakpoint>();
  /**
   * 运行时的断点修改
   * TODO:// 待重构 @Ricbet
   * @param body
   */
  protected async onUpdateBreakpoint(body: DebugProtocol.BreakpointEvent['body']): Promise<void> {
    let breakpoint: IDebugBreakpoint | undefined;
    if (this.settingBreakpoints) {
      await this.settingBreakpoints.promise;
    }

    try {
      const raw = body.breakpoint;
      switch (body.reason) {
        case 'new':
          if (raw.source && typeof raw.line === 'number' && raw.id && !this.id2Breakpoint.has(raw.id)) {
            const uri = DebugSource.toUri(raw.source);
            const bp = DebugBreakpoint.create(uri, { line: raw.line, column: raw.column });
            bp.status.set(this.id, raw);
            this.addBreakpoint(bp);
          }
          break;
        case 'removed':
          if (raw.id) {
            breakpoint = this.id2Breakpoint.get(raw.id);
            if (breakpoint) {
              this.delBreakpoint(breakpoint);
            }
          }
          break;
        case 'changed':
          if (raw.id) {
            breakpoint = this.id2Breakpoint.get(raw.id);
            if (breakpoint) {
              (breakpoint as IRuntimeBreakpoint).status.set(this.id, raw);
              this.breakpointManager.updateBreakpoint(breakpoint, true);
            }
          }
          break;
        default:
          break;
      }
    } finally {
    }
  }

  private async setBreakpoints(affected: URI[]) {
    const promises: Promise<void>[] = [];
    for (const uri of affected) {
      const source = await this.toSource(uri);
      const enableds = this.breakpointManager
        .getBreakpoints(uri)
        .filter((b) => this.breakpointManager.breakpointsEnabled && b.enabled);
      promises.push(
        this.sendRequest('setBreakpoints', {
          source: source.raw,
          sourceModified: false,
          lines: enableds.map((breakpoint) => breakpoint.raw.line),
          breakpoints: enableds.map((breakpoint) => breakpoint.raw),
        })
          .then((res) => {
            res.body.breakpoints.forEach((status, index) => {
              if (status.id) {
                this.id2Breakpoint.set(status.id, enableds[index]);
              }
              const enabledBp = enableds[index] as IRuntimeBreakpoint;
              enabledBp.raw.line = status.line ?? enabledBp.raw.line;
              enabledBp.raw.column = status.column ?? enabledBp.raw.column;
              enabledBp.status.set(this.id, status);
            });
            this.breakpointManager.updateBreakpoints(enableds, true);
            this.breakpointManager.resolveBpDeffered();
            return Promise.resolve();
          })
          .catch((error) => {
            if (!(error instanceof Error)) {
              const genericMessage = 'Breakpoint not valid for current debug session';
              const message: string = error.message ? `${error.message}` : genericMessage;
              enableds.forEach((breakpoint) => {
                (breakpoint as IRuntimeBreakpoint).status.set(this.id, { verified: false, message });
                this.breakpointManager.updateBreakpoint(breakpoint, true);
              });
            }
          }),
      );
    }

    return await Promise.all(promises);
  }

  public delBreakpoint(breakpoint: IDebugBreakpoint): boolean {
    return this.breakpointManager.delBreakpoint(breakpoint);
  }

  public async addBreakpoint(breakpoint: IDebugBreakpoint, isBpDeferred?: boolean): Promise<void> {
    if (isBpDeferred) {
      this.breakpointManager.setBpDeffered();
    }
    this.breakpointManager.addBreakpoint(breakpoint);
    return this.breakpointManager.promiseBpDeffered();
  }

  /**
   * 运行时修改断点信息
   */
  async runtimeUpdateBreakpoint(event: BreakpointsChangeEvent): Promise<void[] | undefined> {
    const { affected, statusUpdated } = event;

    if (statusUpdated) {
      return;
    }

    return await this.setBreakpoints(affected);
  }

  /**
   * 初始化断点信息的锁
   */
  protected settingBreakpoints: Deferred<void> | null = null;
  /**
   * 初始化加载用户的断点信息
   */
  protected async initBreakpoints() {
    this.settingBreakpoints = new Deferred();
    this.id2Breakpoint.clear();

    // 当配置为noDebug时，仅运行程序，不设置断点
    if (!this.configuration.noDebug) {
      await this.setBreakpoints(this.breakpointManager.affected.map((str) => URI.parse(str)));
    }

    this.settingBreakpoints.resolve();
    this.settingBreakpoints = null;
  }

  protected _currentThread: DebugThread | undefined;
  protected _multipleThreadPaused: Map<number, DebugThread> = new Map();

  get currentThread(): DebugThread | undefined {
    return this._currentThread;
  }

  set currentThread(thread: DebugThread | undefined) {
    this.toDisposeOnCurrentThread.dispose();
    this._currentThread = thread;
    if (thread) {
      this.toDisposeOnCurrentThread.push(thread.onDidChanged(() => this.fireDidChange()));
    }
  }

  get multipleThreadPaused(): Map<number, DebugThread> {
    return this._multipleThreadPaused;
  }

  public hasInMultipleThreadPaused(id: number): boolean {
    return this._multipleThreadPaused.has(id);
  }

  protected clearThreads(): void {
    const frontEndTime = this.sessionManager.reportTime(DEBUG_REPORT_NAME.DEBUG_UI_FRONTEND_TIME, {
      sessionId: this.id,
      threadId: this.currentThread?.id,
      threadAmount: this.threadCount,
    });
    this._threads.forEach((thread: DebugThread) => {
      thread.clear();
    });
    this._onDidChangeCallStack.fire();
    this.collocationThread();
    frontEndTime('clearThreads');
  }

  protected clearThread(threadId: number): void {
    const frontEndTime = this.sessionManager.reportTime(DEBUG_REPORT_NAME.DEBUG_UI_FRONTEND_TIME, {
      sessionId: this.id,
      threadId,
      threadAmount: this.threadCount,
    });
    const thread: DebugThread | undefined = this._threads.get(threadId);
    if (thread) {
      thread.clear();
      this._onDidChangeCallStack.fire();
    }
    this.collocationThread();
    frontEndTime('clearThread');
  }

  get state(): DebugState {
    if (this.connection.disposed) {
      return DebugState.Inactive;
    }
    if (!this.initialized) {
      return DebugState.Initializing;
    }
    const thread = this.currentThread;
    if (thread) {
      return thread.stopped ? DebugState.Stopped : DebugState.Running;
    } else if (this.supportsThreadIdCorrespond) {
      return DebugState.Running;
    }
    return this.stoppedThreads.next().value ? DebugState.Stopped : DebugState.Running;
  }

  get currentFrame(): DebugStackFrame | undefined {
    return this.currentThread && this.currentThread.currentFrame;
  }

  async getScopes(parent?: ExpressionContainer): Promise<any[]> {
    const { currentFrame } = this;
    return currentFrame ? currentFrame.getScopes(parent) : [];
  }

  get label(): string {
    if (IDebugSessionDTO.is(this.options) && this.options.id) {
      return this.configuration.name + ' (' + (this.options.id + 1) + ')';
    }
    return this.configuration.name;
  }

  get visible(): boolean {
    return this.state > DebugState.Inactive;
  }

  protected readonly sources = new Map<string, DebugSource>();
  getSource(raw: DebugProtocol.Source): DebugSource {
    const uri = DebugSource.toUri(raw).toString();
    const source =
      this.sources.get(uri) ||
      new DebugSource(this, this.labelProvider, this.modelManager, this.workbenchEditorService, this.fileSystem);
    source.update({ raw });
    this.sources.set(uri, source);
    return source;
  }
  getSourceForUri(uri: URI): DebugSource | undefined {
    return this.sources.get(uri.toString());
  }
  async toSource(uri: URI): Promise<DebugSource> {
    const source = this.getSourceForUri(uri);
    if (source) {
      return source;
    }

    return this.getSource(await this.toDebugSource(uri));
  }

  async toDebugSource(uri: URI): Promise<DebugProtocol.Source> {
    if (uri.scheme === DebugSource.SCHEME) {
      return {
        name: uri.path.toString(),
        sourceReference: Number(uri.query),
      };
    }
    const name = uri.displayName;
    let path: string | undefined = uri.toString();
    if (uri.scheme === 'file') {
      path = await this.fileSystem.getFsPath(path);
    }
    return {
      name,
      path,
      adapterData: undefined,
      sourceReference: undefined,
    };
  }

  protected _threads: Map<number, DebugThread> = new Map();
  get threads(): DebugThread[] {
    return Array.from(this._threads.values());
  }
  get threadCount(): number {
    return this._threads.size;
  }
  *getThreads(filter: (thread: DebugThread) => boolean): IterableIterator<DebugThread> {
    for (const thread of this.threads) {
      if (filter(thread)) {
        yield thread;
      }
    }
  }
  get runningThreads(): IterableIterator<DebugThread> {
    return this.getThreads((thread) => !thread.stopped);
  }
  private get stoppedThreads(): IterableIterator<DebugThread> {
    return this.getThreads((thread) => thread.stopped);
  }
  protected readonly scheduleUpdateThreads = debounce(() => this.updateThreads(undefined), 100);
  protected pendingThreads = Promise.resolve();

  private async rawFetchThreads(threadId?: number): Promise<DebugProtocol.Thread[]> {
    const arg = typeof threadId === 'undefined' ? null : { threadId };
    const response = await this.sendRequest('threads', arg);
    if (response && response.body && response.body.threads && Array.isArray(response.body.threads)) {
      return Promise.resolve(response.body.threads);
    }

    return Promise.resolve([]);
  }

  public async fetchThreads(): Promise<DebugThread[]> {
    const rawThreads = await this.rawFetchThreads();
    const existing = this._threads;
    const threads: DebugThread[] = [];
    for (const raw of rawThreads) {
      const id = raw.id;
      const thread = existing.get(id) || new DebugThread(this);
      threads.push(thread);
      thread.update({ raw });
    }

    return Promise.resolve(threads);
  }

  private updateThreads(stoppedDetails: StoppedDetails | undefined): Promise<void> {
    return (this.pendingThreads = this.pendingThreads.then(async () => {
      try {
        // java debugger returns an empty body sometimes
        const threads = await this.rawFetchThreads();
        this.doUpdateThreads(threads, stoppedDetails);
      } catch (e) {
        // console.error(e);
      }
    }));
  }

  protected doUpdateThreads(rawThreads: DebugProtocol.Thread[], stoppedDetails?: StoppedDetails): void {
    const frontEndTime = this.sessionManager.reportTime(DEBUG_REPORT_NAME.DEBUG_UI_FRONTEND_TIME, {
      sessionId: this.id,
      threadId: stoppedDetails?.threadId,
      threadAmount: rawThreads.length,
    });

    const threadIds: number[] = [];
    rawThreads.forEach((raw: DebugProtocol.Thread) => {
      threadIds.push(raw.id);
      if (!this._threads.has(raw.id)) {
        const thread = new DebugThread(this);
        const data: Partial<Mutable<DebugThreadData>> = { raw };
        thread.update(data);
        this._threads.set(raw.id, thread);
      } else if (raw.name) {
        const oldThread = this._threads.get(raw.id);
        if (oldThread) {
          oldThread.raw.name = raw.name;
        }
      }
    });

    this._threads.forEach((dthread: DebugThread) => {
      const {
        raw: { id },
      } = dthread;
      if (threadIds.indexOf(id) === -1) {
        this._threads.delete(id);
      }
      if (stoppedDetails && (stoppedDetails.allThreadsStopped || stoppedDetails.threadId === id)) {
        this._threads.get(id)?.update({ stoppedDetails });
      }
    });

    this.collocationThread(stoppedDetails);
    frontEndTime('doUpdateThreads');
  }

  /**
   * 两种更新 currentThread 方式
   * 一. collocationThread: 在 threads 列表里查找
   * 二. updateCurrentThread: 发送 threads DAP 给 debug server，由 server 去查找并返回。前提是 supportsThreadIdCorrespond 必须为 true
   */
  protected collocationThread(stoppedDetails?: StoppedDetails): void {
    const { currentThread } = this;
    let threadId = currentThread && currentThread.raw.id;
    if (stoppedDetails && !stoppedDetails.preserveFocusHint && !!stoppedDetails.threadId) {
      threadId = stoppedDetails.threadId;
    }
    this.currentThread =
      (typeof threadId === 'number' && this._threads.get(threadId)) || this._threads.values().next().value;
    if (this.currentThread?.raw.id !== threadId) {
      this.fireDidChange();
    }
  }

  protected async updateCurrentThread(thread?: DebugThread): Promise<void> {
    if (thread) {
      this.currentThread = thread;
      this._onCurrentThreadChange.fire(this.currentThread);
    } else {
      this.currentThread = undefined;
      this._onCurrentThreadChange.fire(undefined);
    }
  }

  /**
   * 收集被暂停的线程 map
   */
  protected async collectPausedThread(stoppedDetails: StoppedDetails): Promise<Map<number, DebugThread>> {
    const threads = await this.rawFetchThreads(stoppedDetails?.threadId);

    if (threads.length === 0) {
      return new Map();
    }

    const debugThread =
      stoppedDetails.threadId && this._multipleThreadPaused.has(stoppedDetails.threadId)
        ? this._multipleThreadPaused.get(stoppedDetails.threadId)
        : new DebugThread(this);
    const data: Partial<Mutable<DebugThreadData>> = { raw: threads[0] };
    if (stoppedDetails && (stoppedDetails.allThreadsStopped || stoppedDetails.threadId === threads[0].id)) {
      data.stoppedDetails = stoppedDetails;
    }

    if (debugThread) {
      debugThread.update(data);
      await this.rawFetchFrames(debugThread);
      this._multipleThreadPaused.set(debugThread.raw.id, debugThread);
    }

    return this._multipleThreadPaused;
  }

  protected async updateCurrentThreadFramesOnFocus(): Promise<void> {
    await this.rawFetchFrames(this.currentThread);
    this._onDidChangeCallStack.fire();

    const editor = this.workbenchEditorService.currentEditor;

    const focus = (f: DebugStackFrame | undefined) => {
      if (this.stoppedDetails && !this.stoppedDetails.preserveFocusHint) {
        this.currentThread!.currentFrame = f;
      }
    };

    if (this.currentThread && !this.currentFrame) {
      // 过滤出有效的 frame source 资源
      const frames = this.currentThread.frames.filter(
        (f: DebugStackFrame) => f && f.source && f.source.raw.presentationHint !== 'deemphasize',
      );
      if (frames.length === 0) {
        return;
      }

      if (editor) {
        const model = editor.monacoEditor.getModel();
        if (model) {
          const uri = URI.parse(model.uri.toString());
          const curFram = frames.filter((f: DebugStackFrame) => f.source!.uri.toString() === uri.toString());
          if (Array.isArray(curFram)) {
            focus(curFram[0]);
          }
        }
      } else {
        focus(frames[0]);
      }
    }
  }

  protected async rawFetchFrames(thread?: DebugThread): Promise<void> {
    if (!thread || thread.frameCount) {
      return;
    }

    if (this.capabilities.supportsDelayedStackTraceLoading) {
      await thread.rawFetchFrames(1);
      await thread.rawFetchFrames(19);
    } else {
      await thread.rawFetchFrames();
    }
  }

  public terminated = false;
  async terminate(restart?: boolean): Promise<void> {
    this.cancelAllRequests();
    if (this.lifecycleManagedByParent && this.parentSession) {
      await this.parentSession.terminate(restart);
      return;
    }

    if (!this.terminated && this.capabilities.supportsTerminateRequest && this.configuration.request === 'launch') {
      this.terminated = true;
      this.sendRequest('terminate', { restart });
      if (!(await this.exited(1000))) {
        await this.disconnect(restart);
      }
    } else {
      await this.disconnect(restart);
    }
  }

  public async disconnect(restart?: boolean): Promise<void> {
    try {
      if (this.lifecycleManagedByParent && this.parentSession) {
        this.parentSession.disconnect(restart);
      } else {
        this.sendRequest('disconnect', { restart });
      }
    } catch (reason) {
      this.fireExited(reason);
      return;
    } finally {
      this._onDidExitAdapter.fire();
      this.onStateChange();
    }
    const timeout = 500;
    if (!(await this.exited(timeout))) {
      this.fireExited(new Error(`timeout after ${timeout} ms`));
    }
  }

  protected updateCapabilities(capabilities: DebugProtocol.Capabilities): void {
    Object.assign(this._capabilities, capabilities);
  }

  protected fireExited(reason?: Error): void {
    this.connection.fire('exited', { reason });
  }

  protected exited(timeout: number): Promise<boolean> {
    return Promise.race([
      this.exitDeferred.promise.then(
        () => true,
        () => false,
      ),
      new Promise<boolean>((resolve) => {
        setTimeout(resolve, timeout, false);
      }),
    ]);
  }

  async restart(): Promise<boolean> {
    this.cancelAllRequests();
    if (this.capabilities.supportsRestartRequest) {
      this.terminated = false;
      if (this.lifecycleManagedByParent && this.parentSession) {
        await this.parentSession.restart();
      } else {
        await this.sendRequest('restart', {});
      }
      return true;
    }
    return false;
  }

  dispose(): void {
    this.toDispose.dispose();
  }

  async evaluate(expression: string, context?: string): Promise<DebugProtocol.EvaluateResponse['body']> {
    // evaluate muse wait for frames updated
    if (this.updateDeffered) {
      await this.updateDeffered?.promise;
    }

    const frameId = this.currentFrame && this.currentFrame.raw.id;

    const response = await this.sendRequest('evaluate', { expression, frameId, context });
    return response.body;
  }

  async goto(args: DebugProtocol.GotoArguments): Promise<DebugProtocol.GotoResponse | void> {
    if (this.capabilities.supportsGotoTargetsRequest) {
      const res = await this.sendRequest('goto', args);
      return res;
    }
  }

  async cancel(progressId: string): Promise<DebugProtocol.CancelResponse | undefined> {
    return this.sendRequest('cancel', { progressId });
  }

  async setVariableValue(args: DebugProtocol.SetVariableArguments): Promise<DebugProtocol.SetVariableResponse | void> {
    if (this.capabilities.supportsSetVariable) {
      const res = await this.sendRequest('setVariable', args);
      this._onVariableChange.fire();
      return res;
    }
  }

  async breakpointLocations(uri: URI, line: number) {
    const source = await this.toSource(uri);
    const response = await this.sendRequest('breakpointLocations', { source: source.raw, line });
    const positions: IPosition[] = (response.body?.breakpoints || []).map((item) => ({
      lineNumber: item.line,
      column: item.column || 1,
    }));
    return Object.values<IPosition>(
      positions.reduce(
        (obj, p) => ({
          ...obj,
          [`${p.lineNumber}:${p.column}`]: p,
        }),
        {},
      ),
    );
  }

  async sendRequest<K extends keyof DebugRequestTypes>(
    command: K,
    args: DebugRequestTypes[K][0],
    token?: CancellationToken,
  ): Promise<DebugRequestTypes[K][1]> {
    if (
      (!this._capabilities.supportsTerminateRequest && command === 'terminate') ||
      (!this._capabilities.supportsCompletionsRequest && command === 'completions') ||
      (!this._capabilities.supportsTerminateThreadsRequest && command === 'terminateThreads')
    ) {
      throw new Error(`debug: ${command} not supported`);
    }

    let requestToken: CancellationToken | undefined;

    if ((['continue', 'next', 'stepIn', 'stepOut', 'threads'] as K[]).some((c) => command === c)) {
      this.handleCancellation(this.currentThread?.raw.id);
    }

    if ((['stackTrace', 'scopes', 'variables', 'completions', 'threads'] as K[]).some((c) => command === c)) {
      requestToken = this.currentThread?.raw.id
        ? this.getNewCancellationToken(this.currentThread?.raw.id, token)
        : undefined;
    }

    try {
      return await this.connection.sendRequest(command, args, this.configuration, requestToken);
    } finally {
      this._onRequest.fire(command);
    }
  }

  protected async takeCommand(command: string) {
    return new Promise<void>((resolve) => {
      const disposable = this.onRequest((e) => {
        if (e === command) {
          disposable.dispose();
          resolve();
        }
      });
    });
  }

  sendCustomRequest<T extends DebugProtocol.Response>(command: string, args?: any): Promise<T> {
    return this.connection.sendCustomRequest(command, args);
  }

  on<K extends keyof DebugEventTypes>(kind: K, listener: (e: DebugEventTypes[K]) => any): IDisposable {
    return this.connection.on(kind, listener);
  }

  get onDidCustomEvent(): Event<DebugProtocol.Event> {
    return this.connection.onDidCustomEvent;
  }

  // REPL

  hasSeparateRepl(): boolean {
    return !this.parentSession || this.options.repl !== 'mergeWithParent';
  }

  // REPL end

  // report service
  reportTime(name: string, defaults?: any): (msg: string | undefined, extra?: any) => number {
    return this.sessionManager.reportTime(name, defaults);
  }

  // Cancellation

  private getNewCancellationToken(threadId: number, token?: CancellationToken): CancellationToken {
    const tokenSource = new CancellationTokenSource(token);
    const tokens = this.cancellationMap.get(threadId) || [];
    tokens.push(tokenSource);
    this.cancellationMap.set(threadId, tokens);

    return tokenSource.token;
  }

  private cancelAllRequests(): void {
    this.cancellationMap.forEach((tokens) => tokens.forEach((t) => t.cancel()));
    this.cancellationMap.clear();
  }

  public handleCancellation(threadId?: number): void {
    if (threadId) {
      const tokens = this.cancellationMap.get(threadId);
      this.cancellationMap.delete(threadId);
      if (tokens) {
        tokens.forEach((t) => t.cancel());
      }
    } else {
      this.cancelAllRequests();
    }
  }

  // Cancellation end

  public getDebugProtocolBreakpoint(breakpointId: string): DebugProtocol.Breakpoint | undefined {
    const data = this.breakpointManager.getBreakpoints().find((bp) => bp.id === breakpointId);
    if (data) {
      const status = data.status.get(this.id);
      const bp: DebugProtocol.Breakpoint = {
        id: status?.id,
        verified: !!status?.verified,
        message: status?.message,
        source: status?.source,
        line: status?.line,
        column: status?.column,
        endLine: status?.endLine,
        endColumn: status?.endColumn,
        instructionReference: status?.instructionReference,
        offset: status?.offset,
      };
      return bp;
    }
    return undefined;
  }

  public currentEditor(): DebugEditor | undefined {
    return this.getModel()?.getEditor();
  }

  public getModel(): IDebugModel | undefined {
    return this.modelManager.model;
  }
}
