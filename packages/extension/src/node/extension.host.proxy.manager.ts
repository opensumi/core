import { Injectable, Optional, Autowired } from '@opensumi/di';
import { MaybePromise, Emitter, IDisposable, toDisposable, Disposable } from '@opensumi/ide-core-common';
import {
  IExtensionHostManager,
  Output,
  EXT_HOST_PROXY_PROTOCOL,
  EXT_SERVER_IDENTIFIER,
  IExtHostProxyRPCService,
  EXT_HOST_PROXY_IDENTIFIER,
  EXT_HOST_PROXY_SERVER_PROT,
} from '../common';
import net from 'net';
import { RPCServiceCenter, INodeLogger } from '@opensumi/ide-core-node';
import { getRPCService, RPCProtocol, IRPCProtocol } from '@opensumi/ide-connection';
import { createSocketConnection } from '@opensumi/ide-connection/lib/node';

@Injectable()
export class ExtensionHostProxyManager implements IExtensionHostManager {
  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

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
    this.setExtHostProxyRPCProtocol();
  }

  private startProxyServer() {
    return new Promise<net.Socket | void>((resolve) => {
      const server = net.createServer();
      this.disposer.addDispose(
        toDisposable(() => {
          this.logger.warn('dispose server');
          server.close();
        }),
      );
      this.logger.log('waiting ext-proxy connecting...');
      server.on('connection', (connection) => {
        this.logger.log('there are new connections coming in');
        // 有新的连接时重新设置 RPCProtocol
        this.setProxyConnection(connection);
        this.setExtHostProxyRPCProtocol();
        resolve();
      });
      server.listen(this.listenOptions);
    });
  }

  private setProxyConnection(connection: net.Socket) {
    const serverConnection = createSocketConnection(connection);
    this.extServiceProxyCenter.setConnection(serverConnection);
    connection.on('close', () => {
      this.extServiceProxyCenter.removeConnection(serverConnection);
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
