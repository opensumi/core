import {
  Emitter,
  Event,
  URI,
  DisposableCollection,
  Disposable,
  IDisposable,
  debounce,
  Mutable,
} from '@ali/ide-core-browser';
import { DebugSessionConnection, DebugEventTypes, DebugRequestTypes } from './debug-session-connection';
import { DebugSessionOptions, InternalDebugSessionOptions } from './debug-session-options';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { IFileServiceClient } from '@ali/ide-file-service';
import { DebugProtocol } from 'vscode-debugprotocol';
import { DebugSource } from './model/debug-source';
import { DebugConfiguration } from '../common';
import { StoppedDetails, DebugThread, DebugThreadData } from './model/debug-thread';
import { IMessageService } from '@ali/ide-overlay';
import { DebugBreakpoint, DebugBreakpointData } from './model/debug-breakpoint';
import { BreakpointManager } from './breakpoint/breakpoint-manager';
import { SourceBreakpoint } from './breakpoint';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { DebugStackFrame } from './model/debug-stack-frame';
import { DebugModelManager } from './editor/debug-model-manager';

export enum DebugState {
  Inactive,
  Initializing,
  Running,
  Stopped,
}

export class DebugSession implements IDisposable {

  protected readonly onDidChangeEmitter = new Emitter<void>();
  readonly onDidChange: Event<void> = this.onDidChangeEmitter.event;
  protected fireDidChange(): void {
    this.onDidChangeEmitter.fire(undefined);
  }

  // 断点改变事件
  protected readonly onDidChangeBreakpointsEmitter = new Emitter<URI>();
  readonly onDidChangeBreakpoints: Event<URI> = this.onDidChangeBreakpointsEmitter.event;

  protected fireDidChangeBreakpoints(uri: URI): void {
    this.onDidChangeBreakpointsEmitter.fire(uri);
  }

  protected readonly toDispose = new DisposableCollection();

  protected _capabilities: DebugProtocol.Capabilities = {};

  get capabilities(): DebugProtocol.Capabilities {
    return this._capabilities;
  }

  constructor(
    readonly id: string,
    readonly options: DebugSessionOptions,
    protected readonly connection: DebugSessionConnection,
    // protected readonly terminalServer: ITerminalService,
    protected readonly workbenchEditorService: WorkbenchEditorService,
    protected readonly breakpoints: BreakpointManager,
    protected readonly modelManager: DebugModelManager,
    protected readonly labelProvider: LabelService,
    protected readonly messages: IMessageService,
    protected readonly fileSystem: IFileServiceClient) {

    // this.connection.onRequest('runInTerminal', (request: DebugProtocol.RunInTerminalRequest) => this.runInTerminal(request));

    this.toDispose.pushAll([
      this.onDidChangeEmitter,
      this.onDidChangeBreakpointsEmitter,
      Disposable.create(() => {
        // 清理断点
        this.clearBreakpoints();
        // 更新线程
        this.doUpdateThreads([]);
      }),
      this.connection,
      // 返回调试配置
      this.on('initialized', () => this.configure()),
      // 更新断点
      this.on('breakpoint', ({ body }) => this.updateBreakpoint(body)),
      this.on('continued', ({ body: { allThreadsContinued, threadId } }) => {
        // 更新线程
        if (allThreadsContinued !== false) {
          this.clearThreads();
        } else {
          this.clearThread(threadId);
        }
      }),
      this.on('stopped', async ({ body }) => {
        await this.updateThreads(body);
        await this.updateFrames();
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
      this.on('terminated', () => this.terminated = true),
      this.on('capabilities', (event) => this.updateCapabilities(event.body.capabilities)),
      // 断点更新时更新断点数据
      this.breakpoints.onDidChangeMarkers((uri) => this.updateBreakpoints({ uri, sourceModified: true })),
    ]);
  }

  get configuration(): DebugConfiguration {
    return this.options.configuration;
  }

  async start(): Promise<void> {
    await this.initialize();
    await this.launchOrAttach();
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
    });
    this.updateCapabilities(response.body || {});
  }
  protected async launchOrAttach(): Promise<void> {
    try {
      if (this.configuration.request === 'attach') {
        await this.sendRequest('attach', this.configuration);
      } else {
        await this.sendRequest('launch', this.configuration);
      }
    } catch (reason) {
      this.fireExited(reason);
      await this.messages.error(reason.message || 'Debug session initialization failed. See console for details.');
      throw reason;
    }
  }
  protected initialized = false;

  protected async configure(): Promise<void> {
    const exceptionBreakpointsOpts = await this.breakpoints.getExceptionBreakpointOptions();
    if (exceptionBreakpointsOpts) {
      await this.setExceptionBreakpoints(exceptionBreakpointsOpts);
    }
    await this.updateBreakpoints({ sourceModified: false });
    if (this.capabilities.supportsConfigurationDoneRequest) {
      await this.sendRequest('configurationDone', {});
    }
    this.initialized = true;
    await this.updateThreads(undefined);
  }

  protected async setExceptionBreakpoints(options: {
    filters: string[],
  }): Promise<void> {
    if (!this.initialize) {
      return;
    }
    try {
      const response = await this.sendRequest('setExceptionBreakpoints', options);
      if (!response.success) {
        console.warn('not support exception breakpoints', response);
      }
    } catch (e) {
      console.error(e);
    }
  }

  protected readonly _breakpoints = new Map<string, DebugBreakpoint[]>();
  protected async updateBreakpoints(options: {
    uri?: URI,
    sourceModified: boolean,
  }): Promise<void> {
    if (this.updatingBreakpoints) {
      return;
    }
    const { uri, sourceModified } = options;
    for (const affectedUri of this.getAffectedUris(uri)) {
      const source = await this.toSource(affectedUri);
      const model = this.modelManager.resolve(affectedUri);
      const all = this.breakpoints.findMarkers({ uri: affectedUri }).map(({ data }) =>
        new DebugBreakpoint(data, this.labelProvider, this.breakpoints, model, this.workbenchEditorService, this),
      );
      const enabled = all.filter((b) => b.enabled);

      try {
        const response = await this.sendRequest('setBreakpoints', {
          source: source.raw,
          sourceModified,
          breakpoints: enabled.map(({ origin }) => origin.raw),
        });
        response.body.breakpoints.map((raw, index) => enabled[index].update({ raw }));
      } catch (error) {
        // could be error or promise rejection of DebugProtocol.SetBreakpointsResponse
        if (error instanceof Error) {
          console.error(`Error setting breakpoints: ${error.message}`);
        } else {
          // handle adapters that send failed DebugProtocol.SetBreakpointsResponse for invalid breakpoints
          const genericMessage: string = 'Breakpoint not valid for current debug session';
          const message: string = error.message ? `${error.message}` : genericMessage;
          console.warn(`Could not handle breakpoints for ${affectedUri}: ${message}, disabling...`);
          enabled.forEach((brkPoint: DebugBreakpoint) => {
            const debugBreakpointData: Partial<DebugBreakpointData> = {
              raw: {
                verified: false,
                message,
              },
            };
            brkPoint.update(debugBreakpointData);
          });
        }
      } finally {
        this.setBreakpoints(affectedUri, all);
      }
    }
  }
  protected setBreakpoints(uri: URI, breakpoints: DebugBreakpoint[]): void {
    const distinct = this.dedupBreakpoints(breakpoints);
    this._breakpoints.set(uri.toString(), distinct);
    this.fireDidChangeBreakpoints(uri);
  }
  protected dedupBreakpoints(all: DebugBreakpoint[]): DebugBreakpoint[] {
    const lines = new Map<number, DebugBreakpoint>();
    for (const breakpoint of all) {
      let primary = lines.get(breakpoint.line) || breakpoint;
      if (primary !== breakpoint) {
        let secondary = breakpoint;
        if (secondary.raw && secondary.raw.line === secondary.origin.raw.line) {
          [primary, secondary] = [breakpoint, primary];
        }
        primary.origins.push(...secondary.origins);
      }
      lines.set(primary.line, primary);
    }
    return [...lines.values()];
  }
  protected *getAffectedUris(uri?: URI): IterableIterator<URI> {
    if (uri) {
      yield uri;
    } else {
      for (const uriString of this.breakpoints.getUris()) {
        yield new URI(uriString);
      }
    }
  }
  get breakpointUris(): IterableIterator<string> {
    return this._breakpoints.keys();
  }
  getBreakpoints(uri?: URI): DebugBreakpoint[] {
    if (uri) {
      return this._breakpoints.get(uri.toString()) || [];
    }
    const result: any[] = [];
    for (const breakpoints of this._breakpoints.values()) {
      result.push(...breakpoints);
    }
    return result;
  }
  protected clearBreakpoints(): void {
    const uris = [...this._breakpoints.keys()];
    this._breakpoints.clear();
    for (const uri of uris) {
      this.fireDidChangeBreakpoints(new URI(uri));
    }
  }

  protected updatingBreakpoints = false;
  protected updateBreakpoint(body: DebugProtocol.BreakpointEvent['body']): void {
    this.updatingBreakpoints = true;
    try {
      const raw = body.breakpoint;
      if (body.reason === 'new') {
        if (raw.source && typeof raw.line === 'number') {
          const uri = DebugSource.toUri(raw.source);
          const origin = SourceBreakpoint.create(uri, { line: raw.line, column: 1 });
          if (this.breakpoints.addBreakpoint(origin)) {
            const breakpoints = this.getBreakpoints(uri);
            const model = this.modelManager.resolve(uri);
            const breakpoint = new DebugBreakpoint(origin, this.labelProvider, this.breakpoints, model, this.workbenchEditorService, this);
            breakpoint.update({ raw });
            breakpoints.push(breakpoint);
            this.setBreakpoints(uri, breakpoints);
          }
        }
      }
      if (body.reason === 'removed' && raw.id) {
        const toRemove = this.findBreakpoint((b) => b.idFromAdapter === raw.id);
        if (toRemove) {
          toRemove.remove();
          const breakpoints = this.getBreakpoints(toRemove.uri);
          const index = breakpoints.indexOf(toRemove);
          if (index !== -1) {
            breakpoints.splice(index, 1);
            this.setBreakpoints(toRemove.uri, breakpoints);
          }
        }
      }
      if (body.reason === 'changed' && raw.id) {
        const toUpdate = this.findBreakpoint((b) => b.idFromAdapter === raw.id);
        if (toUpdate) {
          toUpdate.update({ raw });
          this.fireDidChangeBreakpoints(toUpdate.uri);
        }
      }
    } finally {
      this.updatingBreakpoints = false;
    }
  }

  protected findBreakpoint(match: (breakpoint: DebugBreakpoint) => boolean): DebugBreakpoint | undefined {
    for (const [, breakpoints] of this._breakpoints) {
      for (const breakpoint of breakpoints) {
        if (match(breakpoint)) {
          return breakpoint;
        }
      }
    }
    return undefined;
  }

  protected _currentThread: DebugThread | undefined;
  protected readonly toDisposeOnCurrentThread = new DisposableCollection();

  get currentThread(): DebugThread | undefined {
    return this._currentThread;
  }

  set currentThread(thread: DebugThread | undefined) {
    this.toDisposeOnCurrentThread.dispose();
    this._currentThread = thread;
    this.fireDidChange();
    if (thread) {
      this.toDisposeOnCurrentThread.push(thread.onDidChanged(() => this.fireDidChange()));
    }
  }

  protected clearThreads(): void {
    for (const thread of this.threads) {
      thread.clear();
    }
    this.updateCurrentThread();
  }

  protected clearThread(threadId: number): void {
    const thread = this._threads.get(threadId);
    if (thread) {
      thread.clear();
    }
    this.updateCurrentThread();
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

  async getScopes(): Promise<any[]> {
    const { currentFrame } = this;
    return currentFrame ? currentFrame.getScopes() : [];
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
    const model = this.modelManager.resolve(DebugSource.toUri(raw));
    const source = this.sources.get(uri) || new DebugSource(this, this.labelProvider, model, this.workbenchEditorService, this.fileSystem);
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
    return { name, path };
  }

  protected _threads = new Map<number, DebugThread>();
  get threads(): IterableIterator<DebugThread> {
    return this._threads.values();
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
  protected readonly scheduleUpdateThreads = debounce(100, () => this.updateThreads(undefined));
  protected pendingThreads = Promise.resolve();
  updateThreads(stoppedDetails: StoppedDetails | undefined): Promise<void> {
    return this.pendingThreads = this.pendingThreads.then(async () => {
      try {
        const response = await this.sendRequest('threads', {});
        // java debugger returns an empty body sometimes
        const threads = response && response.body && response.body.threads || [];
        this.doUpdateThreads(threads, stoppedDetails);
      } catch (e) {
        console.error(e);
      }
    });
  }
  protected doUpdateThreads(threads: DebugProtocol.Thread[], stoppedDetails?: StoppedDetails): void {
    const existing = this._threads;
    this._threads = new Map();
    for (const raw of threads) {
      const id = raw.id;
      const thread = existing.get(id) || new DebugThread(this);
      this._threads.set(id, thread);
      const data: Partial<Mutable<DebugThreadData>> = { raw };
      if (stoppedDetails && (stoppedDetails.allThreadsStopped || stoppedDetails.threadId === id)) {
        data.stoppedDetails = stoppedDetails;
      }
      thread.update(data);
    }
    this.updateCurrentThread(stoppedDetails);
  }

  protected updateCurrentThread(stoppedDetails?: StoppedDetails): void {
    const { currentThread } = this;
    let threadId = currentThread && currentThread.raw.id;
    if (stoppedDetails && !stoppedDetails.preserveFocusHint && !!stoppedDetails.threadId) {
      threadId = stoppedDetails.threadId;
    }
    this.currentThread = typeof threadId === 'number' && this._threads.get(threadId)
      || this._threads.values().next().value;
  }

  protected async updateFrames(): Promise<void> {
    const thread = this._currentThread;
    if (!thread || thread.frameCount) {
      return;
    }
    if (this.capabilities.supportsDelayedStackTraceLoading) {
      await thread.fetchFrames(1);
      await thread.fetchFrames(19);
    } else {
      await thread.fetchFrames();
    }
  }

  protected terminated = false;
  async terminate(restart?: boolean): Promise<void> {
    if (!this.terminated && this.capabilities.supportsTerminateRequest && this.configuration.request === 'launch') {
      this.terminated = true;
      await this.connection.sendRequest('terminate', { restart });
      if (!await this.exited(1000)) {
        await this.disconnect(restart);
      }
    } else {
      await this.disconnect(restart);
    }
  }

  protected async disconnect(restart?: boolean): Promise<void> {
    try {
      await this.sendRequest('disconnect', { restart });
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
    return new Promise<boolean>((resolve) => {
      const listener = this.on('exited', () => {
        listener.dispose();
        resolve(true);
      });
      setTimeout(() => {
        listener.dispose();
        resolve(false);
      }, timeout);
    });
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

  sendRequest<K extends keyof DebugRequestTypes>(command: K, args: DebugRequestTypes[K][0]): Promise<DebugRequestTypes[K][1]> {
    return this.connection.sendRequest(command, args);
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
}
