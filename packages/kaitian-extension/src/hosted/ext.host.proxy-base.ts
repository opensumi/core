// tslint:disable:no-console
import * as net from 'net';
import { RPCService, RPCServiceCenter, createSocketConnection, getRPCService, IRPCProtocol, RPCProtocol } from '@ali/ide-connection';
import { IExtHostProxyRPCService, IExtHostProxy, IExtHostProxyOptions, EXT_HOST_PROXY_PROTOCOL, EXT_HOST_PROXY_IDENTIFIER, IExtServerProxyRPCService, EXT_SERVER_IDENTIFIER, EXT_HOST_PROXY_SERVER_PROT } from '../common/ext.host.proxy';
import { Emitter } from '@ali/ide-core-node';
import { ExtensionHostManager } from '../node/extension.host.manager';
import { IExtensionHostManager } from '../common';

class ExtHostProxyRPCService extends RPCService implements IExtHostProxyRPCService {

  private extensionHostManager: IExtensionHostManager;

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

  async $fork(modulePath: string, ...args: any[]) {
    return this.extensionHostManager.fork(modulePath, ...args);
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

}

export class ExtHostProxy implements IExtHostProxy {

  private socket: net.Socket;

  private readonly clientCenter: RPCServiceCenter;

  private protocol: IRPCProtocol;

  private options: IExtHostProxyOptions;

  private reconnecting: number;

  private extServerProxy: IExtServerProxyRPCService;

  constructor(options?: IExtHostProxyOptions) {
    this.options = {
      retryTime: 1000,
      socketConnectOpts: {
        port: EXT_HOST_PROXY_SERVER_PROT,
      },
      ...options,
    },
    this.socket = new net.Socket();
    this.clientCenter = new RPCServiceCenter();
  }

  init() {
    this.bindEvent();
    this.connect();
  }

  private setRPCMethods() {
    const proxyService = getRPCService(EXT_HOST_PROXY_PROTOCOL, this.clientCenter);
    const onMessageEmitter = new Emitter<string>();
    proxyService.on('onMessage', (msg) => {
      onMessageEmitter.fire(msg);
    });
    const onMessage = onMessageEmitter.event;
    const send = proxyService.onMessage;

    this.protocol = new RPCProtocol({
      onMessage,
      send,
    });
    this.extServerProxy = this.protocol.getProxy(EXT_SERVER_IDENTIFIER);
    this.protocol.set(EXT_HOST_PROXY_IDENTIFIER, new ExtHostProxyRPCService(this.extServerProxy));
  }

  private reconnectOnEvent() {
    clearTimeout(this.reconnecting);
    this.reconnecting = setTimeout(() => {
      // tslint
      console.warn('reconnecting ext host server');
      this.connect();
    }, this.options.retryTime);
  }

  private connectOnEvent() {
    console.info('connect success');
    this.setConnection();
    this.setRPCMethods();
  }

  private bindEvent() {
    // connect
    this.socket.on('connect', this.connectOnEvent.bind(this));
    // reconnect
    this.socket.on('end', this.reconnectOnEvent.bind(this));
    this.socket.on('error', this.reconnectOnEvent.bind(this));
    this.socket.on('timeout', this.reconnectOnEvent.bind(this));
    this.socket.on('close', this.reconnectOnEvent.bind(this));
  }

  private setConnection() {
    const connection = createSocketConnection(this.socket);
    this.clientCenter.setConnection(connection);
    this.socket.once('close', () => {
      this.clientCenter.removeConnection(connection);
    });
  }

  private connect() {
    this.socket.connect(this.options.socketConnectOpts!);
  }

}
