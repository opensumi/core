import net from 'net';

import { Autowired, Injectable, Optional } from '@opensumi/di';
import { SumiConnectionMultiplexer } from '@opensumi/ide-connection';
import { NetSocketConnection } from '@opensumi/ide-connection/lib/common/connection';
import { Disposable, IDisposable, MaybePromise, toDisposable } from '@opensumi/ide-core-common';
import { AppConfig, INodeLogger } from '@opensumi/ide-core-node';

import {
  EXT_HOST_PROXY_IDENTIFIER,
  EXT_HOST_PROXY_SERVER_PROT,
  EXT_SERVER_IDENTIFIER,
  IExtHostProxyRPCService,
  IExtensionHostManager,
  Output,
} from '../common';

@Injectable()
export class ExtensionHostProxyManager implements IExtensionHostManager {
  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  private callId = 0;

  private extHostProxyProtocol: SumiConnectionMultiplexer;

  private extHostProxy: IExtHostProxyRPCService;

  private callbackMap = new Map<number, (...args: any[]) => void>();

  private processDisposeMap = new Map<number, IDisposable>();

  private disposer = new Disposable();

  LOG_TAG = '[ExtensionHostProxyManager]';
  connection: NetSocketConnection;

  constructor(
    @Optional()
    private listenOptions: net.ListenOptions = {
      port: EXT_HOST_PROXY_SERVER_PROT,
    },
  ) {}

  async init() {
    await this.startProxyServer();
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
        this.connection = new NetSocketConnection(socket);
        this.disposer.addDispose(
          toDisposable(() => {
            if (!socket.destroyed) {
              socket.destroy();
            }
          }),
        );
        this.setExtHostProxyRPCProtocol();
        resolve();
      });
      server.listen(this.listenOptions);
    });
  }

  private setExtHostProxyRPCProtocol() {
    this.extHostProxyProtocol = new SumiConnectionMultiplexer(this.connection, {
      timeout: this.appConfig.rpcMessageTimeout,
    });

    this.extHostProxyProtocol.set(EXT_SERVER_IDENTIFIER, {
      $callback: async (callId: number, ...args: any[]) => {
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
