/* eslint-disable no-console */

import * as pty from 'node-pty';

import { Injectable, Autowired } from '@opensumi/di';
import { INodeLogger } from '@opensumi/ide-core-node';

import { IPtyProcessProxy, IPtyProxyRPCService, IShellLaunchConfig } from '../common';

import { PtyServiceProxy } from './pty.proxy';

export const PtyServiceManagerToken = Symbol('PtyServiceManager');

/**
 * 在IDE容器中运行，具体分为两类实现。通过DI注入替换来做到两种模式的替换
 * 1.与远程容器通信，完成终端的创建连接一些列事情 - 双容器架构
 * 2.直接走同进程调用，操作终端 - 传统架构
 */
export interface IPtyServiceManager {
  spawn(
    file: string,
    args: string[] | string,
    options: pty.IPtyForkOptions | pty.IWindowsPtyForkOptions,
    sessionId?: string,
  ): Promise<IPtyProcessProxy>;
  // 因为PtyServiceManager是PtyClient端统筹所有Pty的管理类，因此每一个具体方法的调用都需要传入pid来对指定pid做某些操作
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
  checkSession(sessionId: string): Promise<boolean>;
}

// 标准单容器架构 - 在IDE容器中运行，PtyService也在IDE进程中运行
// 如果需要用到双容器远程架构，可以查看PtyServiceManagerRemote的实现
@Injectable()
export class PtyServiceManager implements IPtyServiceManager {
  protected callId = 0;
  protected callbackMap = new Map<number, (...args: any[]) => void>();
  // Pty终端服务的代理，在双容器模式下采用RPC连接，单容器模式下直连
  protected ptyServiceProxy: IPtyProxyRPCService;

  @Autowired(INodeLogger)
  protected logger: INodeLogger;

  // Pty运行在IDE Server上，因此可以直接调用
  constructor() {
    this.initLocal();
  }

  protected initLocal() {
    const callback = async (callId, ...args) => {
      const callback = this.callbackMap.get(callId);
      if (!callback) {
        return Promise.reject(new Error(`no found callback: ${callId}`));
      }
      callback(...args);
    };
    this.ptyServiceProxy = new PtyServiceProxy(callback);
  }

  // 维护一个CallbackMap，用于在PtyServiceProxy中远程调用回调
  // 因为在RPC调用中本身是没法直接传递回调Function的，所以需要在远程调用中传递callId，在本地调用中通过callId获取回调
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
  ): Promise<IPtyProcessProxy> {
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

  async checkSession(sessionId: string): Promise<boolean> {
    return await this.ptyServiceProxy.$checkSession(sessionId);
  }
}

// Pty进程的Remote代理
// 实现了 IPtyProcessProxy 背后是 NodePty的INodePty, 因此可以做到和本地化直接调用NodePty的代码兼容
class PtyProcessProxy implements IPtyProcessProxy {
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

  /**
   * @deprecated 请使用 `IPty.launchConfig` 的 shellPath 字段
   */
  bin: string;

  launchConfig: IShellLaunchConfig;

  parsedName: string;

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

  // 将pid维护到对象内部，对外暴露NodePty的标准api，因此在调用的时候不需要显式传入pid
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
