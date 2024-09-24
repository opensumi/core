import net from 'net';

import { IRPCProtocol, RPCService, SumiConnectionMultiplexer } from '@opensumi/ide-connection';
import { NetSocketConnection } from '@opensumi/ide-connection/lib/common/connection';
import { Disposable, Emitter, IDisposable, getDebugLogger } from '@opensumi/ide-core-node';

import { IExtensionHostManager } from '../common';
import {
  EXT_HOST_PROXY_IDENTIFIER,
  EXT_HOST_PROXY_SERVER_PROT,
  EXT_SERVER_IDENTIFIER,
  IExtHostProxy,
  IExtHostProxyOptions,
  IExtHostProxyRPCService,
  IExtServerProxyRPCService,
} from '../common/ext.host.proxy';
import { ExtensionHostManager } from '../node/extension.host.manager';

import type { ForkOptions } from 'child_process';

class ExtHostProxyRPCService extends RPCService implements IExtHostProxyRPCService {
  private extensionHostManager: IExtensionHostManager;

  LOG_TAG = '[ExtHostProxyRPCService]';

  constructor(private extServerProxy: IExtServerProxyRPCService) {
    super();
    this.extensionHostManager = new ExtensionHostManager();
  }

  async $send(pid: number, message: string): Promise<void> {
    return this.extensionHostManager.send(pid, message);
  }
  async $isRunning(pid: number): Promise<boolean> {
    return this.extensionHostManager.isRunning(pid);
  }
  async $treeKill(pid: number): Promise<void> {
    return this.extensionHostManager.treeKill(pid);
  }
  async $kill(pid: number, signal?: string | undefined) {
    return this.extensionHostManager.kill(pid, signal);
  }

  async $isKilled(pid: number): Promise<boolean> {
    return this.extensionHostManager.isKilled(pid);
  }

  async $fork(modulePath: string, args: string[] = [], options: ForkOptions = {}) {
    // 需要 merge ide server 的环境变量和插件运行的环境变量
    const forkOptions = {
      ...options,
      env: {
        ...options.env,
        ...process.env,
      },
    };
    return this.extensionHostManager.fork(modulePath, args, forkOptions);
  }

  async $onExit(callId: number, pid: number): Promise<void> {
    this.extensionHostManager.onExit(pid, (code, signal) => this.extServerProxy.$callback(callId, code, signal));
  }

  async $onOutput(callId: number, pid: number): Promise<void> {
    this.extensionHostManager.onOutput(pid, (output) => this.extServerProxy.$callback(callId, output));
  }

  async $findDebugPort(startPort: number, giveUpAfter: number, timeout: number) {
    return this.extensionHostManager.findDebugPort(startPort, giveUpAfter, timeout);
  }

  async $onMessage(callId: number, pid: number): Promise<void> {
    this.extensionHostManager.onMessage(pid, (msg) => this.extServerProxy.$callback(callId, msg));
  }

  async $disposeProcess(pid: number): Promise<void> {
    this.extensionHostManager.disposeProcess(pid);
  }

  async $dispose(): Promise<void> {
    await this.extensionHostManager.dispose();
  }
}

export class ExtHostProxy extends Disposable implements IExtHostProxy {
  private socket: net.Socket;

  private protocol: IRPCProtocol;

  private options: IExtHostProxyOptions;

  private reconnectingTimer: NodeJS.Timeout;

  private extServerProxy: IExtServerProxyRPCService;

  private previouslyDisposer: IDisposable;

  private connectedEmitter = this.registerDispose(new Emitter<void>());

  private readonly logger = getDebugLogger();

  public readonly onConnected = this.connectedEmitter.event;

  LOG_TAG = '[ExtHostProxy]';
  disposer: Disposable;

  constructor(options?: IExtHostProxyOptions) {
    super();
    this.options = {
      retryTime: 1000,
      socketConnectOpts: {
        port: EXT_HOST_PROXY_SERVER_PROT,
      },
      ...options,
    };
  }

  init() {
    this.createSocket();
  }

  private createSocket() {
    if (this.previouslyDisposer) {
      this.previouslyDisposer.dispose();
    }
    this.disposer = new Disposable();

    // 每次断连后重新生成 Socket 实例
    this.socket = new net.Socket();
    this.disposer.addDispose(this.bindEvent());
    this.disposer.addDispose(this.connect());

    this.previouslyDisposer = this.disposer;
    this.addDispose(this.previouslyDisposer);
  }

  private setRPCMethods() {
    const connection = new NetSocketConnection(this.socket);

    this.protocol = new SumiConnectionMultiplexer(connection, {
      logger: this.logger,
      timeout: this.options.rpcMessageTimeout,
    });

    this.disposer.addDispose(connection);

    this.extServerProxy = this.protocol.getProxy(EXT_SERVER_IDENTIFIER);
    const extHostProxyRPCService = new ExtHostProxyRPCService(this.extServerProxy);
    this.protocol.set(EXT_HOST_PROXY_IDENTIFIER, extHostProxyRPCService);
    this.disposer.addDispose({
      dispose: () => extHostProxyRPCService.$dispose(),
    });
  }

  private reconnectOnEvent = () => {
    clearTimeout(this.reconnectingTimer);
    this.reconnectingTimer = setTimeout(() => {
      this.logger.warn(this.LOG_TAG, 'reconnecting ext host server');
      this.createSocket();
    }, this.options.retryTime!);
  };

  private connectOnEvent = () => {
    this.logger.info(this.LOG_TAG, 'connect success');
    // this.previouslyConnected = true;
    clearTimeout(this.reconnectingTimer);
    this.setRPCMethods();
    this.connectedEmitter.fire();
  };

  private bindEvent(): IDisposable {
    // connect
    this.socket.on('connect', this.connectOnEvent);
    // reconnect
    this.socket.on('end', this.reconnectOnEvent);
    this.socket.on('error', this.reconnectOnEvent);
    this.socket.on('timeout', this.reconnectOnEvent);
    this.socket.on('close', this.reconnectOnEvent);

    return {
      dispose: () => {
        // connect
        this.socket.off('connect', this.connectOnEvent);
        // reconnect
        this.socket.off('end', this.reconnectOnEvent);
        this.socket.off('error', this.reconnectOnEvent);
        this.socket.off('timeout', this.reconnectOnEvent);
        this.socket.off('close', this.reconnectOnEvent);
      },
    };
  }

  private connect = (): IDisposable => {
    this.socket.connect(this.options.socketConnectOpts!);
    return {
      dispose: () => {
        this.socket.destroy();
      },
    };
  };
}
