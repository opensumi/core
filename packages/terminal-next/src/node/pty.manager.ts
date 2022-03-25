/* eslint-disable no-console */
import net from 'net';

import * as pty from 'node-pty';

import { Injectable, Optional, Autowired } from '@opensumi/di';
import { RPCServiceCenter, initRPCService } from '@opensumi/ide-connection';
import { createSocketConnection } from '@opensumi/ide-connection/lib/node';
import { INodeLogger } from '@opensumi/ide-core-node';

import {
  IPtyProxyRPCService,
  PTY_SERVICE_PROXY_CALLBACK_PROTOCOL,
  PTY_SERVICE_PROXY_PROTOCOL,
  PTY_SERVICE_PROXY_SERVER_PORT,
} from '../common';

import { PtyServiceProxy } from './pty.proxy';

export const PtyServiceManagerToken = Symbol('PtyServiceManager');

/**
 * 在IDE容器中运行，具体分为两类实现。通过DI注入替换来做到两种模式的替换
 * 1.与远程容器通信，完成终端的创建连接一些列事情 - 双容器架构
 * 2.直接走同进程调用，操作终端 - 传统架构
 */
interface IPtyServiceManager {
  spawn(
    file: string,
    args: string[] | string,
    options: pty.IPtyForkOptions | pty.IWindowsPtyForkOptions,
    sessionId?: string,
  ): Promise<pty.IPty>;
  onData(pid: number, listener: (e: string) => any): pty.IDisposable;
  onExit(pid: number, listener: (e: { exitCode: number; signal?: number }) => any): pty.IDisposable;
  on(pid: number, event: 'data', listener: (data: string) => void): void;
  on(pid: number, event: 'exit', listener: (exitCode: number, signal?: number) => void): void;
  on(pid: number, event: any, listener: (data: any) => void): void;
  resize(pid: number, columns: number, rows: number): void;
  write(pid: number, data: string): void;
  pause(pid: number): void;
  resume(pid: number): void;
  kill(pid: number, signal?: string): void;
  getProcess(pid): Promise<string>;
}

// 双容器架构 - 在IDE容器中远程运行，与DEV Server上的PtyService通信
// 标准单容器架构 - 在IDE容器中运行，PtyService也在IDE进程中运行
// 具体取决于构造函数中使用何种InitMode
@Injectable()
export class PtyServiceManager implements IPtyServiceManager {
  private callId = 0;
  private callbackMap = new Map<number, (...args: any[]) => void>();
  // Pty终端服务的代理，在双容器模式下采用RPC连接，单容器模式下直连
  private ptyServiceProxy: IPtyProxyRPCService;

  @Autowired(INodeLogger)
  private logger: INodeLogger;

  constructor(@Optional() initMode: 'remote' | 'local' = 'local') {
    if (initMode === 'remote') {
      this.initRemoteConnectionMode();
    } else {
      this.initLocalInit();
    }
  }

  private initRemoteConnectionMode() {
    const clientCenter = new RPCServiceCenter();
    const { getRPCService: clientGetRPCService, createRPCService } = initRPCService(clientCenter);
    // TODO: 思考any是否应该在这里用 亦或者做空判断
    const getService: IPtyProxyRPCService = clientGetRPCService(PTY_SERVICE_PROXY_PROTOCOL) as any;
    this.ptyServiceProxy = getService;

    // 处理回调
    createRPCService(PTY_SERVICE_PROXY_CALLBACK_PROTOCOL, {
      $callback: async (callId, ...args) => {
        const callback = this.callbackMap.get(callId);
        if (!callback) {
          // 这里callbackMap的callId对应的回调方法被注销，但是依然被调用了，这种情况不应该发生
          this.logger.warn('PtyServiceManager not found callback:', callId);
        } else {
          callback(...args);
        }
      },
    });
    const socket = new net.Socket();
    socket.connect({ port: PTY_SERVICE_PROXY_SERVER_PORT });

    // 连接绑定
    clientCenter.setConnection(createSocketConnection(socket));
    return getService;
  }

  private initLocalInit() {
    const callback = async (callId, ...args) => {
      const callback = this.callbackMap.get(callId);
      if (!callback) {
        return Promise.reject(new Error(`no found callback: ${callId}`));
      }
      callback(...args);
    };
    this.ptyServiceProxy = new PtyServiceProxy(callback);
  }

  private addNewCallback(
    pid: number,
    callback: (...args: any[]) => void,
  ): { callId: number; disposable: pty.IDisposable } {
    const callId = this.callId++;
    this.callbackMap.set(callId, callback);
    const disposable: pty.IDisposable = {
      dispose: () => {
        this.callbackMap.delete(callId);
      },
    };
    return { callId, disposable };
  }

  async spawn(
    file: string,
    args: string[] | string,
    options: pty.IPtyForkOptions | pty.IWindowsPtyForkOptions,
    sessionId?: string,
  ): Promise<pty.IPty> {
    const iPtyRemoteProxy = (await this.ptyServiceProxy.$spawn(file, args, options, sessionId)) as pty.IPty;
    // 局部功能的Ipty, 代理所有常量
    return new PtyProcessProxy(iPtyRemoteProxy, this);
  }

  async getProcess(pid: any): Promise<string> {
    return await this.ptyServiceProxy.$getProcess(pid);
  }

  // 实现Ipty的需要回调的逻辑接口，同时注入
  onData(pid: number, listener: (e: string) => any): pty.IDisposable {
    const { callId, disposable } = this.addNewCallback(pid, listener);
    this.ptyServiceProxy.$onData(callId, pid);
    return disposable;
  }
  onExit(pid: number, listener: (e: { exitCode: number; signal?: number }) => any): pty.IDisposable {
    const { callId, disposable } = this.addNewCallback(pid, listener);
    this.ptyServiceProxy.$onExit(callId, pid);
    return disposable;
  }

  on(pid: number, event: 'data', listener: (data: string) => void): void;
  on(pid: number, event: 'exit', listener: (exitCode: number, signal?: number) => void): void;
  on(pid: number, event: any, listener: (data: any) => void): void {
    const { callId } = this.addNewCallback(pid, listener);
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
  private ptyServiceManager: IPtyServiceManager;
  constructor(iptyProxy: pty.IPty, ptyServiceManager: IPtyServiceManager) {
    this.ptyServiceManager = ptyServiceManager;
    this.pid = iptyProxy.pid;
    this.cols = iptyProxy.cols;
    this.rows = iptyProxy.rows;
    this._process = iptyProxy.process;
    this.handleFlowControl = iptyProxy.handleFlowControl;

    this.onData = (listener: (e: string) => any) => this.ptyServiceManager.onData(this.pid, listener);
    this.onExit = (listener: (e: { exitCode: number; signal?: number }) => any) =>
      this.ptyServiceManager.onExit(this.pid, listener);
  }
  pid: number;
  cols: number;
  rows: number;
  _process: string;
  handleFlowControl: boolean;

  get process(): string {
    return this._process;
  }

  // 获取实时的ProcessName
  async getProcessDynamically(): Promise<string> {
    const process = await this.ptyServiceManager.getProcess(this.pid);
    this._process = process;
    return process;
  }

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
