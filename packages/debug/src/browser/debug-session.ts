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
} from '@ali/ide-core-browser';
import debounce = require('lodash.debounce');
import { DebugSessionConnection, DebugEventTypes, DebugRequestTypes, DebugExitEvent } from './debug-session-connection';
import { DebugSessionOptions, InternalDebugSessionOptions, IDebugSession, IDebugSessionManager, DEBUG_REPORT_NAME } from '../common';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { IFileServiceClient } from '@ali/ide-file-service';
import { DebugProtocol } from '@ali/vscode-debugprotocol';
import { DebugSource } from './model/debug-source';
import { DebugConfiguration } from '../common';
import { StoppedDetails, DebugThread, DebugThreadData } from './model/debug-thread';
import { IMessageService } from '@ali/ide-overlay';
import { BreakpointManager, BreakpointsChangeEvent, IRuntimeBreakpoint, DebugBreakpoint } from './breakpoint';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { DebugStackFrame } from './model/debug-stack-frame';
import { DebugModelManager } from './editor/debug-model-manager';
import { CancellationTokenSource, CancellationToken } from '@ali/ide-core-common';
import { ITerminalApiService, TerminalOptions } from '@ali/ide-terminal-next';
import { ExpressionContainer } from './tree/debug-tree-node.define';

export enum DebugState {
  Inactive,
  Initializing,
  Running,
  Stopped,
}

export class DebugSession implements IDebugSession {

  protected readonly onDidChangeEmitter = new Emitter<void>();
  readonly onDidChange: Event<void> = this.onDidChangeEmitter.event;
  public fireDidChange(): void {
    this.onDidChangeEmitter.fire(undefined);
  }

  private _onDidChangeCallStack = new Emitter<void>();
  readonly onDidChangeCallStack: Event<void> = this._onDidChangeCallStack.event;

  private _onVariableChange = new Emitter<void>();
  readonly onVariableChange: Event<void> = this._onVariableChange.event;

  private _onRequest = new Emitter<string>();
  readonly onRequest: Event<string> = this._onRequest.event;

  protected readonly toDispose = new DisposableCollection();

  protected _capabilities: DebugProtocol.Capabilities = {};

  get capabilities(): DebugProtocol.Capabilities {
    return this._capabilities;
  }

  protected updateDeffered: Deferred<void> | null = null;

  protected exitDeferred = new Deferred<DebugExitEvent>();

  protected cancellationMap = new Map<number, CancellationTokenSource[]>();

  constructor(
    readonly id: string,
    readonly options: DebugSessionOptions,
    protected readonly connection: DebugSessionConnection,
    protected readonly terminalService: ITerminalApiService,
    protected readonly workbenchEditorService: WorkbenchEditorService,
    protected readonly breakpoints: BreakpointManager,
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
      this.on('continued', ({ body: { allThreadsContinued, threadId } }) => {
        // 更新线程
        if (allThreadsContinued !== false) {
          this.clearThreads();
          return;
        }

        if (threadId) {
          this.clearThread(threadId);
          const tokens = this.cancellationMap.get(threadId);
          this.cancellationMap.delete(threadId);
          if (tokens) {
            tokens.forEach((t) => t.cancel());
          }
        } else {
          this.cancelAllRequests();
        }
      }),
      this.on('stopped', async ({ body }) => {
        const { threadId } = body;
        const reportTime = this.sessionManager.reportTime(DEBUG_REPORT_NAME.DEBUG_STOPPED, {
          sessionId: this.id,
          threadId,
        });
        this.updateDeffered = new Deferred();
        await this.updateThreads(body);
        await this.updateFrames();
        this.updateDeffered.resolve();
        // 下一个 scopes 触发后 action 结束
        await this.takeCommand('scopes');
        reportTime('stopped');
        // action 结束后需要清除
        const extra = this.sessionManager.getExtra(this.id, threadId);
        if (threadId && extra && extra.action) {
          extra.action = undefined;
          this.sessionManager.setExtra(this.id, `${threadId ?? ''}`, extra);
        }
      }),
      this.on('thread', ({ body: { reason, threadId } }) => {
        if (reason === 'started') {
          // 队列更新线程
          this.scheduleUpdateThreads();
        } else if (reason === 'exited') {
          // 清理线程数据
          this.clearThread(threadId);
        }
      }),
      this.on('terminated', () => {
        this.terminated = true;
      }),
      this.on('exited', (reason) => {
        this.exitDeferred.resolve(reason);
      }),
      this.on('capabilities', (event) => this.updateCapabilities(event.body.capabilities)),
      this.breakpoints.onDidChangeBreakpoints((event) => this.updateBreakpoint(event)),
      this.breakpoints.onDidChangeExceptionsBreakpoints((args) => {
        if (this.breakpoints.breakpointsEnabled) {
          this.setExceptionBreakpoints(args);
        }
      }),
      {
        dispose: () => {
          // 清除断点的运行时状态
          this.breakpoints.clearAllStatus(this.id);
        },
      },
    ]);
  }

  get configuration(): DebugConfiguration {
    return this.options.configuration;
  }

  get parentSession(): IDebugSession | undefined {
    return this.options.parentSession;
  }

  async start(): Promise<void> {
    await this.workbenchEditorService.saveAll();
    await this.initialize();
    await this.launchOrAttach();
  }

  protected async runInTerminal({ arguments: { title, cwd, args, env } }: DebugProtocol.RunInTerminalRequest): Promise<DebugProtocol.RunInTerminalResponse['body']> {
    // TODO: shellPath 参数解析
    return this.doRunInTerminal({ name: title, cwd, env }, args.join(' '));
  }

  protected async doRunInTerminal(options: TerminalOptions, command?: string): Promise<DebugProtocol.RunInTerminalResponse['body']> {
    const activeTerminal = this.terminalService.terminals.find((terminal) => terminal.name === options.name && terminal.isActive);
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
    const response = await this.connection.sendRequest('initialize', {
      clientID: 'KatiTian',
      clientName: 'KatiTian IDE',
      adapterID: this.configuration.type,
      locale: 'en-US',
      linesStartAt1: true,
      columnsStartAt1: true,
      pathFormat: 'path',
      supportsVariableType: false,
      supportsVariablePaging: false,
      supportsRunInTerminalRequest: true,
    }, this.configuration);
    this.updateCapabilities(response.body || {});
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
    this.breakpoints.setExceptionBreakpoints(this.capabilities.exceptionBreakpointFilters || []);
    if (this.capabilities.supportsConfigurationDoneRequest) {
      await this.sendRequest('configurationDone', {});
    }
    this.initialized = true;
    await this.updateThreads(undefined);
  }

  protected async setExceptionBreakpoints(
    args: DebugProtocol.SetExceptionBreakpointsArguments,
  ): Promise<DebugProtocol.SetExceptionBreakpointsResponse> {
    return this.sendRequest('setExceptionBreakpoints', args);
  }

  /**
   * runtime 时候的临时缓存，每次调试的时候都应该清空，
   * 会等待首次初始化完成
   */
  protected id2Breakpoint = new Map<number, DebugBreakpoint>();
  /**
   * 运行时的断点修改
   * TODO:// 待重构 @倾一
   * @param body
   */
  protected async onUpdateBreakpoint(body: DebugProtocol.BreakpointEvent['body']): Promise<void> {
    let breakpoint: DebugBreakpoint | undefined;
    if (this.settingBreakpoints) {
      await this.settingBreakpoints.promise;
    }

    try {
      const raw = body.breakpoint;
      switch (body.reason) {
        case 'new':
          if (raw.source && typeof raw.line === 'number' && raw.id && !this.id2Breakpoint.has(raw.id)) {
            const uri = DebugSource.toUri(raw.source);
            this.breakpoints.addBreakpoint(DebugBreakpoint.create(uri, { line: raw.line, column: raw.column }));
          }
          break;
        case 'removed':
          if (raw.id) {
            breakpoint = this.id2Breakpoint.get(raw.id);
            if (breakpoint) {
              this.breakpoints.delBreakpoint(breakpoint);
            }
          }
          break;
        case 'changed':
          if (raw.id) {
            breakpoint = this.id2Breakpoint.get(raw.id);
            if (breakpoint) {
              (breakpoint as IRuntimeBreakpoint).status.set(this.id, raw);
              this.breakpoints.updateBreakpoint(breakpoint);
            }
          }
          break;
        default:
          break;
      }
    } finally { }

  }

  private async setBreakpoints(affected: URI[]) {
    const promises: Promise<void>[] = [];
    if (!this.breakpoints.breakpointsEnabled) {
      return;
    }
    for (const uri of affected) {
      const source = await this.toSource(uri);
      const enabled = this.breakpoints.getBreakpoints(uri).filter((b) => b.enabled);

      promises.push(
        this.sendRequest('setBreakpoints', {
          source: source.raw,
          sourceModified: false,
          lines: enabled.map((breakpoint) => breakpoint.raw.line),
          breakpoints: enabled.map((breakpoint) => breakpoint.raw),
        })
          .then((res) => {
            res.body.breakpoints.forEach((status, index) => {
              if (status.id) {
                this.id2Breakpoint.set(status.id, enabled[index]);
              }
              (enabled[index] as IRuntimeBreakpoint).status.set(this.id, status);
            });
            this.breakpoints.updateBreakpoints(enabled, true);
            return Promise.resolve();
          })
          .catch((error) => {
            if (!(error instanceof Error)) {
              const genericMessage: string = 'Breakpoint not valid for current debug session';
              const message: string = error.message ? `${error.message}` : genericMessage;
              enabled.forEach((breakpoint) => {
                (breakpoint as IRuntimeBreakpoint).status.set(this.id, { verified: false, message });
                this.breakpoints.updateBreakpoint(breakpoint, true);
              });
            }
          }));
    }

    return await Promise.all(promises);
  }

  /**
   * 运行时修改断点信息
   */
  async updateBreakpoint(event: BreakpointsChangeEvent) {
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
      await this.setBreakpoints(this.breakpoints.affected.map((str) => URI.parse(str)));
    }

    this.settingBreakpoints.resolve();
    this.settingBreakpoints = null;
  }

  protected _currentThread: DebugThread | undefined;

  get currentThread(): DebugThread | undefined {
    return this._currentThread;
  }

  set currentThread(thread: DebugThread | undefined) {
    this._currentThread = thread;
    if (thread) {
      this.fireDidChange();
    }
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
    this.updateCurrentThread();
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
    this.updateCurrentThread();
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
    }
    return !!this.stoppedThreads.next().value ? DebugState.Stopped : DebugState.Running;
  }

  get currentFrame(): DebugStackFrame | undefined {
    return this.currentThread && this.currentThread.currentFrame;
  }

  async getScopes(parent?: ExpressionContainer): Promise<any[]> {
    const { currentFrame } = this;
    return currentFrame ? currentFrame.getScopes(parent) : [];
  }

  get label(): string {
    if (InternalDebugSessionOptions.is(this.options) && this.options.id) {
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
    const source = this.sources.get(uri) || new DebugSource(this, this.labelProvider, this.modelManager, this.workbenchEditorService, this.fileSystem);
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

  // protected _threads: DebugThread[] = [];
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
  get stoppedThreads(): IterableIterator<DebugThread> {
    return this.getThreads((thread) => thread.stopped);
  }
  protected readonly scheduleUpdateThreads = debounce(() => this.updateThreads(undefined), 100);
  protected pendingThreads = Promise.resolve();
  updateThreads(stoppedDetails: StoppedDetails | undefined): Promise<void> {
    return this.pendingThreads = this.pendingThreads.then(async () => {
      try {
        const response = await this.sendRequest('threads', {});
        // java debugger returns an empty body sometimes
        const threads = response && response.body && response.body.threads || [];
        this.doUpdateThreads(threads, stoppedDetails);
      } catch (e) {
        // console.error(e);
      }
    });
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
      const { raw: { id } } = dthread;
      if (threadIds.indexOf(id) === -1) {
        this._threads.delete(id);
      }
      if (stoppedDetails && (stoppedDetails.allThreadsStopped || stoppedDetails.threadId === id)) {
        this._threads.get(id)?.update({ stoppedDetails });
      }
    });

    this.updateCurrentThread(stoppedDetails);
    frontEndTime('doUpdateThreads');
  }

  protected updateCurrentThread(stoppedDetails?: StoppedDetails): void {
    const { currentThread } = this;
    let threadId = currentThread && currentThread.raw.id;
    if (stoppedDetails && !stoppedDetails.preserveFocusHint && !!stoppedDetails.threadId) {
      threadId = stoppedDetails.threadId;
    }
    this.currentThread = typeof threadId === 'number' && this._threads.get(threadId) || this._threads.values().next().value;
    if (this.currentThread?.raw.id !== threadId) {
      this.fireDidChange();
    }
  }

  protected async updateFrames(): Promise<void> {
    const thread = this.currentThread;
    if (!thread || thread.frameCount) {
        return;
    }

    if (this.capabilities.supportsDelayedStackTraceLoading) {
        await thread.fetchFrames(1);
        await thread.fetchFrames(19);
    } else {
        await thread.fetchFrames();
    }

    this._onDidChangeCallStack.fire();

    // set current frame from editor
    const editor = this.workbenchEditorService.currentEditor;
    if (editor && this.currentThread && !this.currentFrame) {
      const model = editor.monacoEditor.getModel();
      if (model) {
        const uri = URI.parse(model.uri.toString());
        const frames = this.currentThread.frames.filter((f) => f.source?.uri.toString() === uri.toString());
        if (frames) {
          this.currentThread.currentFrame = frames[0];
        }
      }
    }
  }

  public terminated = false;
  async terminate(restart?: boolean): Promise<void> {
    if (!this.terminated && this.capabilities.supportsTerminateRequest && this.configuration.request === 'launch') {
      this.terminated = true;
      this.sendRequest('terminate', { restart });
      if (!await this.exited(1000)) {
        await this.disconnect(restart);
      }
    } else {
      await this.disconnect(restart);
    }
  }

  protected async disconnect(restart?: boolean): Promise<void> {
    try {
      this.sendRequest('disconnect', { restart });
    } catch (reason) {
      this.fireExited(reason);
      return;
    }
    const timeout = 500;
    if (!await this.exited(timeout)) {
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
      this.exitDeferred.promise.then(() => true, () => false),
      new Promise<boolean>((resolve) => {
        setTimeout(resolve, timeout, false);
      }),
    ]);
  }

  async restart(): Promise<boolean> {
    if (this.capabilities.supportsRestartRequest) {
      this.terminated = false;
      await this.sendRequest('restart', {});
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
    const positions: IPosition[] = (response.body?.breakpoints || []).map((item) => ({ lineNumber: item.line, column: item.column || 1 }));
    return Object.values<IPosition>(positions.reduce((obj, p) => ({
      ...obj,
      [`${p.lineNumber}:${p.column}`]: p,
    }), {}));
  }

  async sendRequest<K extends keyof DebugRequestTypes>(command: K, args: DebugRequestTypes[K][0], token?: CancellationToken): Promise<DebugRequestTypes[K][1]> {
    if (
      (!this._capabilities.supportsTerminateRequest && command === 'terminate') ||
      (!this._capabilities.supportsCompletionsRequest && command === 'completions') ||
      (!this._capabilities.supportsTerminateThreadsRequest && command === 'terminateThreads')
    ) {
      throw new Error(`debug: ${command} not supported`);
    }

    let requestToken: CancellationToken | undefined;

    if (
      (['stackTrace', 'scopes', 'variables', 'completions', 'threads'] as K[]).some((c) => command === c)
    ) {
      requestToken = this.currentThread?.raw.id ? this.getNewCancellationToken(this.currentThread?.raw.id, token) : undefined;
    }

    try {
      return await this.connection.sendRequest(command, args, this.configuration, requestToken);
    } finally {
      this._onRequest.fire(command);
    }
  }

  protected async takeCommand(command: string) {
    return new Promise((resolve) => {
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

  // Cancellation end

}
