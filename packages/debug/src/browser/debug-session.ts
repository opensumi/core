import {
  Emitter,
  Event,
  URI,
  DisposableCollection,
  Disposable,
  IDisposable,
} from '@ali/ide-core-browser';
import { DebugSessionConnection, DebugEventTypes } from './debug-session-connection';
import { DebugSessionOptions } from './debug-session-options';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import { DebugProtocol } from 'vscode-debugprotocol';
import { DebugSource } from './model/debug-source';

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
    // protected readonly terminalServer: TerminalService,
    // protected readonly editorManager: EditorManager,
    // protected readonly breakpoints: BreakpointManager,
    protected readonly labelProvider: LabelService,
    // protected readonly messages: MessageClient,
    protected readonly fileSystem: FileServiceClient) {

    // this.connection.onRequest('runInTerminal', (request: DebugProtocol.RunInTerminalRequest) => this.runInTerminal(request));

    this.toDispose.pushAll([
      this.onDidChangeEmitter,
      this.onDidChangeBreakpointsEmitter,
      Disposable.create(() => {
        // 清理断点
        // this.clearBreakpoints();
        // 更新线程
        // this.doUpdateThreads([]);
      }),
      this.connection,
      // 返回调试配置
      this.on('initialized', () => this.configure()),
      // 更新断点
      // this.on('breakpoint', ({ body }) => this.updateBreakpoint(body)),
      this.on('continued', ({ body: { allThreadsContinued, threadId } }) => {
        // 更新线程
        if (allThreadsContinued !== false) {
          // this.clearThreads();
        } else {
          // this.clearThread(threadId);
        }
      }),
      this.on('stopped', async ({ body }) => {
        // await this.updateThreads(body);
        // await this.updateFrames();
      }),
      this.on('thread', ({ body: { reason, threadId } }) => {
        if (reason === 'started') {
          // 队列更新线程
          // this.scheduleUpdateThreads();
        } else if (reason === 'exited') {
          // 清理线程数据
          // this.clearThread(threadId);
        }
      }),
      this.on('terminated', () => this.terminated = true),
      this.on('capabilities', (event) => this.updateCapabilities(event.body.capabilities)),
      // 断点更新时更新断点数据
      // this.breakpoints.onDidChangeMarkers((uri) => this.updateBreakpoints({ uri, sourceModified: true })),
    ]);
  }

  protected initialized = false;

  protected async configure(): Promise<void> {
    await this.updateBreakpoints({ sourceModified: false });
    if (this.capabilities.supportsConfigurationDoneRequest) {
      await this.sendRequest('configurationDone', {});
    }
    this.initialized = true;
    await this.updateThreads(undefined);
  }

  protected updatingBreakpoints = false;
  protected updateBreakpoint(body: DebugProtocol.BreakpointEvent['body']): void {
    this.updatingBreakpoints = true;
    try {
      const raw = body.breakpoint;
      // if (body.reason === 'new') {
      //     if (raw.source && typeof raw.line === 'number') {
      //         const uri = DebugSource.toUri(raw.source);
      //         const origin = SourceBreakpoint.create(uri, { line: raw.line, column: 1 });
      //         if (this.breakpoints.addBreakpoint(origin)) {
      //             const breakpoints = this.getBreakpoints(uri);
      //             const breakpoint = new DebugBreakpoint(origin, this.labelProvider, this.breakpoints, this.editorManager, this);
      //             breakpoint.update({ raw });
      //             breakpoints.push(breakpoint);
      //             this.setBreakpoints(uri, breakpoints);
      //         }
      //     }
      // }
      // if (body.reason === 'removed' && raw.id) {
      //     const toRemove = this.findBreakpoint((b) => b.idFromAdapter === raw.id);
      //     if (toRemove) {
      //         toRemove.remove();
      //         const breakpoints = this.getBreakpoints(toRemove.uri);
      //         const index = breakpoints.indexOf(toRemove);
      //         if (index !== -1) {
      //             breakpoints.splice(index, 1);
      //             this.setBreakpoints(toRemove.uri, breakpoints);
      //         }
      //     }
      // }
      // if (body.reason === 'changed' && raw.id) {
      //     const toUpdate = this.findBreakpoint((b) => b.idFromAdapter === raw.id);
      //     if (toUpdate) {
      //         toUpdate.update({ raw });
      //         this.fireDidChangeBreakpoints(toUpdate.uri);
      //     }
      // }
    } finally {
      this.updatingBreakpoints = false;
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

  dispose(): void {
    this.toDispose.dispose();
  }

  on<K extends keyof DebugEventTypes>(kind: K, listener: (e: DebugEventTypes[K]) => any): IDisposable {
    return this.connection.on(kind, listener);
  }
}
