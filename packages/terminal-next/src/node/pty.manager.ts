import * as pty from 'node-pty';

import { Autowired, Injectable } from '@opensumi/di';
import { Deferred, INodeLogger } from '@opensumi/ide-core-node';

import { IPtyProcessProxy, IPtyProxyRPCService, IPtySpawnOptions, IShellLaunchConfig } from '../common';

import { PtyServiceProxy } from './pty.proxy';

export const PtyServiceManagerToken = Symbol('PtyServiceManager');

/**
 * 在 IDE 容器中运行，具体分为两类实现。通过 DI 注入替换来做到两种模式的替换
 * 1.与远程容器通信，完成终端的创建连接一些列事情 - 双容器架构
 * 2.直接走同进程调用，操作终端 - 传统架构
 */
export interface IPtyServiceManager {
  spawn(
    file: string,
    args: string[] | string,
    ptyOptions: pty.IPtyForkOptions | pty.IWindowsPtyForkOptions,
    sessionId?: string,
    spawnOptions?: IPtySpawnOptions,
  ): Promise<IPtyProcessProxy>;
  // 因为 PtyServiceManage 是 PtyClient 端统筹所有 Pty 的管理类，因此每一个具体方法的调用都需要传入 pid 来对指定 pid 做某些操作
  onData(pid: number, listener: (e: string) => any): pty.IDisposable;
  onExit(pid: number, listener: (e: { exitCode: number; signal?: number }) => any): pty.IDisposable;
  resize(pid: number, columns: number, rows: number): void;
  write(pid: number, data: string): void;
  pause(pid: number): void;
  resume(pid: number): void;
  clear(pid: number): void;
  kill(pid: number, signal?: string): void;
  getProcess(pid: number): Promise<string>;
  getCwd(pid: number): Promise<string | undefined>;
  checkSession(sessionId: string): Promise<boolean>;
}

// 记录终端输入到输出的时间戳，主要是用于统计 Pty 处理 + IDE <--> Pty 的IPC 耗时
let timeCaptureTmp = 0;
// 终端的命令可能会有多行输出，避免后面几次输出也被用于时间差计算统计，因此一次 write，一次统计
let timeCaptureFilter = false;

// 标准单容器架构 - 在 IDE 容器中运行，PtyService 也在 IDE 进程中运行
// 如果需要用到双容器远程架构，可以查看 PtyServiceManagerRemote 的实现
@Injectable()
export class PtyServiceManager implements IPtyServiceManager {
  protected callId = 0;
  protected callbackMap = new Map<number, (...args: any[]) => void>();
  // Pty 终端服务的代理，在双容器模式下采用 RPC 连接，单容器模式下直连
  protected ptyServiceProxy: IPtyProxyRPCService;
  protected ptyServiceProxyDeferred = new Deferred();

  @Autowired(INodeLogger)
  protected logger: INodeLogger;

  // Pty 运行在 IDE Server 上，因此可以直接调用
  constructor() {
    this.initLocal();
  }

  protected initLocal() {
    const callback = async (callId: number, ...args) => {
      const callback = this.callbackMap.get(callId);
      if (!callback) {
        return Promise.reject(new Error(`no found callback: ${callId}`));
      }
      callback(...args);
    };
    this.ptyServiceProxy = new PtyServiceProxy(callback);
    this.ptyServiceProxyDeferred.resolve();
  }

  // 维护一个 CallbackMap，用于在 PtyServiceProxy 中远程调用回调
  // 因为在 RPC 调用中本身是没法直接传递回调 Function 的，所以需要在远程调用中传递 callId，在本地调用中通过 callId 获取回调
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
    spawnOptions?: IPtySpawnOptions,
  ): Promise<IPtyProcessProxy> {
    await this.ptyServiceProxyDeferred.promise;
    const ptyRemoteProxy = (await this.ptyServiceProxy.$spawn(
      file,
      args,
      options,
      sessionId,
      spawnOptions,
    )) as pty.IPty;
    // 局部功能的 IPty, 代理所有常量
    return new PtyProcessProxy(ptyRemoteProxy, this);
  }

  async getProcess(pid: number): Promise<string> {
    return await this.ptyServiceProxy.$getProcess(pid);
  }

  async getCwd(pid: number): Promise<string | undefined> {
    return await this.ptyServiceProxy.$getCwd(pid);
  }

  // 实现 IPty 的需要回调的逻辑接口，同时注入
  onData(pid: number, listener: (e: string) => any): pty.IDisposable {
    const monitorListener = (resString) => {
      listener(resString);
      if (timeCaptureFilter) {
        const timeDiff = new Date().getTime() - timeCaptureTmp;
        this.logger.log(`PtyServiceManager.onData: ${timeDiff}ms data: ${resString.substring(0, 100)}`);
        timeCaptureFilter = false;
      }
    };
    const { callId, disposable } = this.addNewCallback(pid, monitorListener);
    this.ptyServiceProxy.$onData(callId, pid);
    return disposable;
  }

  onExit(pid: number, listener: (e: { exitCode: number; signal?: number }) => any): pty.IDisposable {
    const { callId, disposable } = this.addNewCallback(pid, listener);
    this.ptyServiceProxy.$onExit(callId, pid);
    return disposable;
  }

  resize(pid: number, columns: number, rows: number): void {
    this.ptyServiceProxy.$resize(pid, columns, rows);
  }

  clear(pid: number) {
    this.ptyServiceProxy.$clear(pid);
  }

  write(pid: number, data: string): void {
    timeCaptureTmp = new Date().getTime();
    if (data.includes('=')) {
      // 使用 '=' 作为触发本地通信统计的标识
      timeCaptureFilter = true;
    }
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

// Pty 进程的 Remote 代理
// 实现了 IPtyProcessProxy 背后是 NodePty 的 INodePty, 因此可以做到和本地化直接调用 NodePty 的代码兼容
class PtyProcessProxy implements IPtyProcessProxy {
  private ptyServiceManager: IPtyServiceManager;
  constructor(ptyProxy: pty.IPty, ptyServiceManager: IPtyServiceManager) {
    this.ptyServiceManager = ptyServiceManager;
    this.pid = ptyProxy.pid;
    this.cols = ptyProxy.cols;
    this.rows = ptyProxy.rows;
    this._process = ptyProxy.process;
    this.handleFlowControl = ptyProxy.handleFlowControl;

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

  async getCwd(): Promise<string | undefined> {
    return await this.ptyServiceManager.getCwd(this.pid);
  }

  onData: pty.IEvent<string>;
  onExit: pty.IEvent<{ exitCode: number; signal?: number }>;

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
  clear(): void {
    this.ptyServiceManager.clear(this.pid);
  }
}
