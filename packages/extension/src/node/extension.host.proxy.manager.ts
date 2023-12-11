import net from 'net';

import { Injectable, Optional, Autowired } from '@opensumi/di';
import {
  getRPCService,
  RPCProtocol,
  IRPCProtocol,
  SimpleCommonChannelHandler,
  SocketChannel,
} from '@opensumi/ide-connection';
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
    return new Promise<void>((resolve, reject) => {
      const server = net.createServer();
      this.disposer.addDispose(
        toDisposable(() => {
          this.logger.warn('dispose server');
          server.close();
        }),
      );
      const channelHandler = new SimpleCommonChannelHandler('extension-host-proxy-manager', this.logger);

      this.logger.log('waiting ext-proxy connecting...');
      server.on('connection', (connection) => {
        this.logger.log('there are new connections coming in');
        // 有新的连接时重新设置 RPCProtocol
        const toDispose = channelHandler.handleSocket(
          {
            onmessage: (cb) => {
              connection.on('data', cb);
              return {
                dispose: () => {
                  connection.off('data', cb);
                },
              };
            },
            send: (data) => {
              connection.write(data);
            },
          },
          {
            onSocketChannel: (channel) => {
              this.setProxyConnection(connection, channel);
              this.setExtHostProxyRPCProtocol();
              resolve();
            },
            onError: (error) => {
              reject(error);
            },
          },
        );
        connection.on('close', () => {
          toDispose && toDispose.dispose();
        });
      });

      server.listen(this.listenOptions);
    });
  }

  private setProxyConnection(connection: net.Socket, channel: SocketChannel) {
    const messageConnection = channel.createMessageConnection();
    const binaryConnection = channel.createBinaryConnection();
    this.extServiceProxyCenter.setConnection(messageConnection, binaryConnection);
    connection.once('close', () => {
      this.extServiceProxyCenter.removeConnection(messageConnection);
      this.extServiceProxyCenter.removeBinaryConnection(binaryConnection);
      channel.dispose();
    });

    this.disposer.addDispose(
      toDisposable(() => {
        if (!connection.destroyed) {
          connection.destroy();
        }
      }),
    );
  }

  private setExtHostProxyRPCProtocol() {
    const proxyService = getRPCService<{ onMessage: (msg: any) => void }>(
      EXT_HOST_PROXY_PROTOCOL,
      this.extServiceProxyCenter,
    );

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
      await this.extHostProxy?.$dispose();
      this.disposer.dispose();
    }
  }
}
