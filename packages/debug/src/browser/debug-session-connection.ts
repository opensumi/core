import { DebugConfiguration } from 'vscode';

import { Injectable, Optional, Autowired } from '@opensumi/di';
import { IWebSocket } from '@opensumi/ide-connection';
import {
  Event,
  Emitter,
  DisposableCollection,
  Disposable,
  IDisposable,
  Deferred,
  getDebugLogger,
} from '@opensumi/ide-core-browser';
import { CancellationToken } from '@opensumi/ide-core-common';
import { OutputChannel } from '@opensumi/ide-output/lib/browser/output.channel';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol';

import {
  DebugEventTypes,
  DebugExitEvent,
  DebugRequestTypes,
  DEBUG_REPORT_NAME,
  getSequenceId,
  IDebugSessionManager,
} from '../common';


import { DebugSessionManager } from './debug-session-manager';

export type DebugRequestHandler = (request: DebugProtocol.Request) => any;

const standardDebugEvents = new Set<Required<keyof DebugEventTypes>>([
  'breakpoint',
  'capabilities',
  'continued',
  'exited',
  'initialized',
  'loadedSource',
  'module',
  'output',
  'process',
  'stopped',
  'terminated',
  'thread',
  'progressStart',
  'progressUpdate',
  'progressEnd',
  'invalidated',
]);

@Injectable({ multiple: true })
export class DebugSessionConnection implements IDisposable {
  @Autowired(IDebugSessionManager)
  protected readonly manager: DebugSessionManager;

  protected readonly pendingRequests = new Map<number, (response: DebugProtocol.Response) => void>();
  protected readonly connection: Promise<IWebSocket>;

  protected readonly requestHandlers = new Map<string, DebugRequestHandler>();

  protected readonly onDidCustomEventEmitter = new Emitter<DebugProtocol.Event>();
  readonly onDidCustomEvent: Event<DebugProtocol.Event> = this.onDidCustomEventEmitter.event;

  protected readonly toDispose = new DisposableCollection(
    this.onDidCustomEventEmitter,
    Disposable.create(() => this.pendingRequests.clear()),
    Disposable.create(() => this.emitters.clear()),
  );

  constructor(
    @Optional() readonly sessionId: string,
    @Optional() protected readonly connectionFactory: (sessionId: string) => Promise<IWebSocket>,
    @Optional() protected readonly traceOutputChannel: OutputChannel | undefined,
  ) {
    this.connection = this.createConnection();
  }

  get disposed(): boolean {
    return this.toDispose.disposed;
  }

  dispose(): void {
    this.toDispose.dispose();
  }

  /**
   * 通过 Connection 模块创建可与 Node 进程通信的链接
   * @returns IWebSocket
   */
  protected async createConnection(): Promise<IWebSocket> {
    if (this.disposed) {
      throw new Error('Connection has been already disposed.');
    } else {
      const connection = await this.connectionFactory(this.sessionId);
      connection.onClose((code, reason) => {
        this.fire('exited', { code, reason });
      });

      connection.onMessage((data) => this.handleMessage(data));

      this.toDispose.push(
        Disposable.create(() => {
          connection.close();
        }),
      );
      return connection;
    }
  }

  protected allThreadsContinued = true;

  protected sessionAdapterID: DebugProtocol.InitializeRequestArguments['adapterID'];

  async sendRequest<K extends keyof DebugRequestTypes>(
    command: K,
    args: DebugRequestTypes[K][0],
    configuration: DebugConfiguration,
    token?: CancellationToken,
  ): Promise<DebugRequestTypes[K][1]> {
    /**
     * 在接收到 initialize 请求的时候记录当前的 session 适配器类型
     */
    if (command === 'initialize') {
      this.sessionAdapterID = (args as DebugProtocol.InitializeRequestArguments).adapterID;
    }

    const reportDAP = this.manager.reportTime(DEBUG_REPORT_NAME.DEBUG_ADAPTER_PROTOCOL_TIME, {
      sessionId: this.sessionId,
      threadId: (args && (args as DebugProtocol.ThreadsArguments).threadId) || this.manager.currentThread?.raw.id,
    });
    const result = await this.doSendRequest(command, args, token);

    /*
     * 对 threads 请求增加 数量 统计
     */
    const reportExtra: any = {
      adapterID: this.sessionAdapterID,
      request: configuration.request,
    };

    if (command === 'threads') {
      reportExtra.amount = (result as DebugProtocol.ThreadsResponse).body.threads.length;
    }

    reportDAP(command, reportExtra);

    if (
      command === 'next' ||
      command === 'stepIn' ||
      command === 'stepOut' ||
      command === 'stepBack' ||
      command === 'reverseContinue' ||
      command === 'restartFrame'
    ) {
      this.fireContinuedEvent((args as any).threadId);
    }
    if (command === 'continue') {
      const response = result as DebugProtocol.ContinueResponse;
      const allThreadsContinued = response && response.body && response.body.allThreadsContinued;
      if (allThreadsContinued !== undefined) {
        this.allThreadsContinued = result.body.allThreadsContinued;
      }
      this.fireContinuedEvent((args as any).threadId, this.allThreadsContinued);
      return result;
    }
    return result;
  }

  sendCustomRequest<T extends DebugProtocol.Response>(command: string, args?: any): Promise<T> {
    return this.doSendRequest<T>(command, args);
  }

  protected async doSendRequest<K extends DebugProtocol.Response>(
    command: string,
    args: any = null,
    token?: CancellationToken,
  ): Promise<K> {
    const result = new Deferred<K>();

    const request: DebugProtocol.Request = {
      seq: getSequenceId(),
      type: 'request',
      command,
    };

    let cancelationListener: IDisposable;
    if (args && Object.keys(args).length > 0) {
      request.arguments = args;
    }

    this.pendingRequests.set(request.seq, (response: any) => {
      if (cancelationListener) {
        cancelationListener.dispose();
      }
      if (!response.success) {
        result.reject(response);
      } else {
        result.resolve(response);
      }
    });

    if (token) {
      cancelationListener = token.onCancellationRequested(async () => {
        cancelationListener.dispose();
        const session = this.manager.getSession(this.sessionId);
        if (session && session.capabilities.supportsCancelRequest) {
          session.sendRequest('cancel', {
            requestId: request.seq,
          });
        }
      });
    }

    await this.send(request);
    return result.promise;
  }

  protected async send(message: DebugProtocol.ProtocolMessage): Promise<void> {
    const connection = await this.connection;
    const messageStr = JSON.stringify(message);
    if (this.traceOutputChannel) {
      this.traceOutputChannel.appendLine(`${this.sessionId.substring(0, 8)} [UI -> adapter]: ${messageStr}`);
    }
    connection.send(messageStr);
  }

  protected handleMessage(data: string) {
    if (this.traceOutputChannel) {
      this.traceOutputChannel.appendLine(`${this.sessionId.substring(0, 8)} [adapter -> UI ]: ${data}`);
    }
    const message: DebugProtocol.ProtocolMessage = JSON.parse(data);
    if (message.type === 'request') {
      this.handleRequest(message as DebugProtocol.Request);
    } else if (message.type === 'response') {
      this.handleResponse(message as DebugProtocol.Response);
    } else if (message.type === 'event') {
      this.handleEvent(message as DebugProtocol.Event);
    }
  }

  protected handleResponse(response: DebugProtocol.Response): void {
    const callback = this.pendingRequests.get(response.request_seq);
    if (callback) {
      this.pendingRequests.delete(response.request_seq);
      callback(response);
    }
  }

  onRequest(command: string, handler: DebugRequestHandler): void {
    this.requestHandlers.set(command, handler);
  }

  protected async handleRequest(request: DebugProtocol.Request): Promise<void> {
    const response: DebugProtocol.Response = {
      type: 'response',
      seq: getSequenceId(),
      command: request.command,
      request_seq: request.seq,
      success: true,
    };
    const handler = this.requestHandlers.get(request.command);
    if (handler) {
      try {
        response.body = handler(request);
      } catch (error) {
        response.success = false;
        response.message = error.message;
      }
    } else {
      getDebugLogger().error('Unhandled request', request);
    }
    await this.send(response);
  }

  protected handleEvent(event: DebugProtocol.Event): void {
    if ('event' in event) {
      if (event.event === 'continued') {
        this.allThreadsContinued =
          (event as DebugProtocol.ContinuedEvent).body.allThreadsContinued === false ? false : true;
      }
      if (standardDebugEvents.has(event.event as keyof DebugEventTypes)) {
        this.doFire(event.event, event);
      } else {
        this.onDidCustomEventEmitter.fire(event);
      }
    } else {
      this.fire('exited', event as DebugEventTypes['exited']);
    }
  }

  protected readonly emitters = new Map<string, Emitter<DebugProtocol.Event | DebugExitEvent>>();
  on<K extends keyof DebugEventTypes>(kind: K, listener: (e: DebugEventTypes[K]) => any): IDisposable {
    if (this.disposed) {
      return Disposable.create(() => {});
    }
    return this.getEmitter(kind).event(listener);
  }

  public fire<K extends keyof DebugEventTypes>(kind: K, e: DebugEventTypes[K]): void {
    this.doFire(kind, e);
  }

  protected doFire(kind: string, e: DebugProtocol.Event | DebugExitEvent): void {
    if (this.disposed) {
      return;
    }
    this.getEmitter(kind).fire(e);
  }

  protected getEmitter(kind: string): Emitter<DebugProtocol.Event | DebugExitEvent> {
    const emitter = this.emitters.get(kind) || this.newEmitter();
    this.emitters.set(kind, emitter);
    return emitter;
  }

  protected newEmitter(): Emitter<DebugProtocol.Event | DebugExitEvent> {
    const emitter = new Emitter<DebugProtocol.Event | DebugExitEvent>();
    this.toDispose.push(emitter);
    return emitter;
  }

  protected fireContinuedEvent(threadId: number, allThreadsContinued = false): void {
    this.fire('continued', {
      type: 'event',
      event: 'continued',
      body: {
        threadId,
        allThreadsContinued,
      },
      seq: getSequenceId(),
    });
  }
}
