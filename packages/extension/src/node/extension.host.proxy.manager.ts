import net from 'net';

import { Injectable, Optional, Autowired } from '@opensumi/di';
import { getRPCService, RPCProtocol, IRPCProtocol, WSChannel } from '@opensumi/ide-connection';
import { NetSocketConnection } from '@opensumi/ide-connection/lib/common/connection';
import { MaybePromise, Emitter, IDisposable, toDisposable, Disposable } from '@opensumi/ide-core-common';
import { RPCServiceCenter, INodeLogger, AppConfig } from '@opensumi/ide-core-node';

import {
  IExtensionHostManager,
  Output,
  EXT_HOST_PROXY_PROTOCOL,
  EXT_SERVER_IDENTIFIER,
  IExtHostProxyRPCService,
  EXT_HOST_PROXY_IDENTIFIER,
  EXT_HOST_PROXY_SERVER_PROT,
} from '../common';

@Injectable()
export class ExtensionHostProxyManager implements IExtensionHostManager {
  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  private callId = 0;

  private extHostProxyProtocol: IRPCProtocol;

  private readonly extServiceProxyCenter = new RPCServiceCenter();

  private extHostProxy: IExtHostProxyRPCService;

  private callbackMap = new Map<number, (...args: any[]) => void>();

  private processDisposeMap = new Map<number, IDisposable>();

  private disposer = new Disposable();

  get LOG_TAG() {
    return '[ExtensionHostProxyManager]';
  }

  constructor(
    @Optional()
    private listenOptions: net.ListenOptions = {
      port: EXT_HOST_PROXY_SERVER_PROT,
    },
  ) {}

  async init() {
    await this.startProxyServer();
    this.setExtHostProxyRPCProtocol();
  }

  private startProxyServer() {
    return new Promise<void>((resolve) => {
      const server = net.createServer();
      this.disposer.addDispose(
        toDisposable(() => {
          this.logger.warn(this.LOG_TAG, 'dispose server');
          server.close((err) => {
            if (err) {
              this.logger.error(this.LOG_TAG, 'close server error', err);
            }
          });
        }),
      );

      this.logger.log(this.LOG_TAG, 'waiting ext-proxy connecting...');
      server.on('connection', (socket) => {
        this.logger.log(this.LOG_TAG, 'there are new connections coming in');
        // 有新的连接时重新设置 RPCProtocol
        this.setProxyConnection(socket);
        this.setExtHostProxyRPCProtocol();
        resolve();
      });
      server.listen(this.listenOptions);
    });
  }

  private setProxyConnection(connection: net.Socket) {
    const channel = WSChannel.forClient(new NetSocketConnection(connection), {
      id: 'EXT_HOST_PROXY',
      tag: 'ExtensionHostProxyManager',
    });
    const remove = this.extServiceProxyCenter.setConnection(channel.createMessageConnection());
    connection.once('close', () => {
      remove.dispose();
    });

    this.disposer.addDispose(
      toDisposable(() => {
        connection.destroy();
        connection.end();
      }),
    );
  }

  private setExtHostProxyRPCProtocol() {
    const proxyService = getRPCService(EXT_HOST_PROXY_PROTOCOL, this.extServiceProxyCenter);

    const onMessageEmitter = new Emitter<string>();
    proxyService.on('onMessage', (msg) => {
      onMessageEmitter.fire(msg);
    });
    const onMessage = onMessageEmitter.event;
    const send = proxyService.onMessage;

    this.extHostProxyProtocol = new RPCProtocol({
      onMessage,
      send,
      timeout: this.appConfig.rpcMessageTimeout,
    });

    this.extHostProxyProtocol.set(EXT_SERVER_IDENTIFIER, {
      $callback: async (callId, ...args) => {
        const callback = this.callbackMap.get(callId);
        if (!callback) {
          return Promise.reject(new Error(`no found callback: ${callId}`));
        }
        callback(...args);
      },
    });

    this.extHostProxy = this.extHostProxyProtocol.getProxy(EXT_HOST_PROXY_IDENTIFIER);
  }

  private addNewCallback(pid: number, callback: (...args: any[]) => void) {
    const callId = this.callId++;
    this.callbackMap.set(callId, callback);
    this.processDisposeMap.set(
      pid,
      toDisposable(() => {
        this.callbackMap.delete(callId);
      }),
    );
    this.disposer.addDispose(
      toDisposable(() => {
        this.processDisposeMap.delete(pid);
        this.callbackMap.delete(callId);
      }),
    );
    return callId;
  }

  fork(modulePath: string, ...args: any[]) {
    return this.extHostProxy.$fork(modulePath, ...args);
  }
  send(pid: number, message: string) {
    return this.extHostProxy.$send(pid, message);
  }
  isRunning(pid: number): MaybePromise<boolean> {
    return this.extHostProxy.$isRunning(pid);
  }
  treeKill(pid: number): MaybePromise<void> {
    return this.extHostProxy.$treeKill(pid);
  }
  kill(pid: number, signal?: string | undefined): MaybePromise<void> {
    return this.extHostProxy.$kill(pid, signal);
  }
  isKilled(pid: number): MaybePromise<boolean> {
    return this.extHostProxy.$isKilled(pid);
  }
  findDebugPort(startPort: number, giveUpAfter: number, timeout: number): Promise<number> {
    return this.extHostProxy.$findDebugPort(startPort, giveUpAfter, timeout);
  }
  onOutput(pid: number, listener: (output: Output) => void): MaybePromise<void> {
    const callId = this.addNewCallback(pid, listener);
    return this.extHostProxy.$onOutput(callId, pid);
  }
  onExit(pid: number, listener: (code: number, signal: string) => void): MaybePromise<void> {
    const callId = this.addNewCallback(pid, listener);
    return this.extHostProxy.$onExit(callId, pid);
  }

  onMessage(pid: number, listener: (msg: any) => void): MaybePromise<void> {
    const callId = this.addNewCallback(pid, listener);
    return this.extHostProxy.$onMessage(callId, pid);
  }

  disposeProcess(pid: number): MaybePromise<void> {
    const disposer = this.processDisposeMap.get(pid);
    if (disposer) {
      disposer.dispose();
      this.processDisposeMap.delete(pid);
    }
    return this.extHostProxy.$disposeProcess(pid);
  }

  async dispose() {
    if (!this.disposer.disposed) {
      this.logger.log(this.LOG_TAG, 'dispose ext host proxy');
      await this.extHostProxy?.$dispose();
      this.disposer.dispose();
    }
  }
}
