/* eslint-disable no-console */
import net from 'net';

import * as pty from 'node-pty';

import { Injectable } from '@opensumi/di';
import { RPCServiceCenter, initRPCService } from '@opensumi/ide-connection';
import { createSocketConnection } from '@opensumi/ide-connection/lib/node';

import {
  IPtyProxyRPCService,
  PTY_SERVICE_PROXY_CALLBACK_PROTOCOL,
  PTY_SERVICE_PROXY_PROTOCOL,
  PTY_SERVICE_PROXY_SERVER_PORT,
} from '../common';

export const PtyServiceManagerToken = Symbol('PtyServiceManager');

// 在IDE容器中远程运行，与DEV Server通信
@Injectable()
export class PtyServiceManager {
  private callId = 0;
  private callbackMap = new Map<number, (...args: any[]) => void>();
  private ptyServiceProxy: IPtyProxyRPCService;

  constructor() {
    this.initRemoteConnection();
  }

  initRemoteConnection() {
    const clientCenter = new RPCServiceCenter();
    const { getRPCService: clientGetRPCService, createRPCService } = initRPCService(clientCenter);
    // const self = this;
    // TODO: 思考any是否应该在这里用 亦或者做空判断
    const getService: IPtyProxyRPCService = clientGetRPCService(PTY_SERVICE_PROXY_PROTOCOL) as any;
    this.ptyServiceProxy = getService;

    // 处理回调
    createRPCService(PTY_SERVICE_PROXY_CALLBACK_PROTOCOL, {
      $callback: async (callId, ...args) => {
        const callback = this.callbackMap.get(callId);
        console.log(PTY_SERVICE_PROXY_CALLBACK_PROTOCOL, callId, args);
        if (!callback) {
          return Promise.reject(new Error(`no found callback: ${callId}`));
        }
        callback(...args);
      },
    });
    const socket = new net.Socket();
    socket.connect({ port: PTY_SERVICE_PROXY_SERVER_PORT });

    // 连接绑定
    clientCenter.setConnection(createSocketConnection(socket));
    return getService;
  }

  addNewCallback(pid: number, callback: (...args: any[]) => void) {
    const callId = this.callId++;
    this.callbackMap.set(callId, callback);
    return callId;
    // TODO: dispose 逻辑
  }

  async spawn(
    file: string,
    args: string[] | string,
    options: pty.IPtyForkOptions | pty.IWindowsPtyForkOptions,
    sessionId?: string,
  ): Promise<pty.IPty> {
    const iPtyRemoteProxy = (await this.ptyServiceProxy.$spawn(file, args, options, sessionId)) as pty.IPty;
    // 局部功能的Ipty, 代理所有常量
    // TODO 改造ptyServiceProxy，支持常量的返回 以及方法的代理
    return new PtyProcessProxy(iPtyRemoteProxy, this);
  }

  // 实现Ipty的需要回调的逻辑接口，同时注入
  onData(pid: number, listener: (e: string) => any) {
    const callId = this.addNewCallback(pid, listener);
    this.ptyServiceProxy.$onData(callId, pid);
  }
  onExit(pid: number, listener: (e: { exitCode: number; signal?: number }) => any) {
    const callId = this.addNewCallback(pid, listener);
    this.ptyServiceProxy.$onExit(callId, pid);
  }

  on(pid: number, event: 'data', listener: (data: string) => void): void;
  on(pid: number, event: 'exit', listener: (exitCode: number, signal?: number) => void): void;
  on(pid: number, event: any, listener: (data: any) => void): void {
    const callId = this.addNewCallback(pid, listener);
    this.ptyServiceProxy.$on(callId, pid, event);
  }

  resize(pid: number, columns: number, rows: number): void {
    this.ptyServiceProxy.$resize(pid, columns, rows);
  }
  write(pid: number, data: string): void {
    this.ptyServiceProxy.$write(pid, data);
  }
  kill(pid: number, signal?: string): void {
    this.ptyServiceProxy.$kill(pid, signal);
  }
  pause(pid: number): void {
    this.ptyServiceProxy.$pause(pid);
  }
  resume(pid: number): void {
    this.ptyServiceProxy.$resume(pid);
  }
}

// Pty进程的Remote代理
class PtyProcessProxy implements pty.IPty {
  private ptyServiceManager: PtyServiceManager;
  constructor(iptyProxy: pty.IPty, ptyServiceManager: PtyServiceManager) {
    this.ptyServiceManager = ptyServiceManager;
    this.pid = iptyProxy.pid;
    this.cols = iptyProxy.cols;
    this.rows = iptyProxy.rows;
    this.process = iptyProxy.process;
    this.handleFlowControl = iptyProxy.handleFlowControl;

    this.onData = (listener: (e: string) => any) => {
      this.ptyServiceManager.onData(this.pid, listener);
      const disposeable = {
        dispose: () => {},
      };
      return disposeable;
    };

    this.onExit = (listener: (e: { exitCode: number; signal?: number }) => any) => {
      this.ptyServiceManager.onExit(this.pid, listener);
      const disposeable = {
        dispose: () => {},
      };
      return disposeable;
    };
  }
  pid: number;
  cols: number;
  rows: number;
  process: string;
  handleFlowControl: boolean;

  onData: pty.IEvent<string>;
  onExit: pty.IEvent<{ exitCode: number; signal?: number }>;

  on(event: 'data', listener: (data: string) => void): void;
  on(event: 'exit', listener: (exitCode: number, signal?: number) => void): void;
  on(event: any, listener: any): void {
    this.ptyServiceManager.on(this.pid, event, listener);
  }
  resize(columns: number, rows: number): void {
    this.ptyServiceManager.resize(this.pid, columns, rows);
  }
  write(data: string): void {
    this.ptyServiceManager.write(this.pid, data);
  }
  kill(signal?: string): void {
    this.ptyServiceManager.kill(this.pid, signal);
  }
  pause(): void {
    this.ptyServiceManager.pause(this.pid);
  }
  resume(): void {
    this.ptyServiceManager.resume(this.pid);
  }
}
