/* eslint-disable no-console */
import fs from 'fs';
import net, { ListenOptions, Server } from 'net';

import * as pty from 'node-pty';

import { RPCServiceCenter, initRPCService } from '@opensumi/ide-connection';
import { createSocketConnection } from '@opensumi/ide-connection/lib/node';
import { DisposableCollection, getDebugLogger } from '@opensumi/ide-core-node';

import {
  IPtyProxyRPCService,
  PTY_SERVICE_PROXY_CALLBACK_PROTOCOL,
  PTY_SERVICE_PROXY_PROTOCOL,
  PTY_SERVICE_PROXY_SERVER_PORT,
} from '../common';

// 存储Pty-onData返回的数据行，用于用户Resume场景下的数据恢复
class PtyLineDataCache {
  private size: number;
  private dataArray: string[] = [];

  constructor(size = 100) {
    this.size = size;
  }

  public get data(): string[] {
    return this.dataArray;
  }

  public add(data: string): void {
    if (this.dataArray.length >= this.size) {
      this.dataArray.shift();
    }
    this.dataArray.push(data);
  }

  public clear(): void {
    this.dataArray = [];
  }
}

// 在DEV容器中远程运行，与IDE Server通信

type PID = number;
type SessionId = string;

/**
 * NOTE: 这里面的Session通常是短Session  也就是OpenSumi里面Session `${clientId}|${sessionId}` 的sessionId部分
 * 因为ClientId在每次刷新都会变化，而SessionId可以被持久化保存，后续按照之前的SessionID连接Pty的时候就可以做到Terminal Resume
 *
 * PtyServiceProxy是真实运行的托管着NodePty的代理
 */
export class PtyServiceProxy implements IPtyProxyRPCService {
  // Map <pid, pty> 存放进程Pid和Pty实例的映射
  private ptyInstanceMap = new Map<PID, pty.IPty>();
  // 存放Pid和对应Pty产生数据的记录
  private ptyDataCacheMap = new Map<PID, PtyLineDataCache>();
  // 存放Session和Pid的映射
  private ptySessionMap = new Map<SessionId, PID>();
  private ptyDisposableMap = new Map<PID, DisposableCollection>();

  private readonly debugLogger = getDebugLogger('PtyServiceProxy');
  private $callback: (callId: number, ...args) => void = () => {};

  constructor(callback: (callId: number, ...args) => void) {
    this.$callback = callback;
  }

  // 检查Pty的PID是否存活
  private checkProcess(pid: PID) {
    try {
      process.kill(pid, 0);
      return true;
    } catch (e) {
      return false;
    }
  }

  $checkSession(sessionId: string): boolean {
    const pid = this.ptySessionMap.get(sessionId);
    if (pid) {
      return this.checkProcess(pid);
    } else {
      return false;
    }
  }

  $spawn(
    file: string,
    args: string[] | string,
    options: pty.IPtyForkOptions | pty.IWindowsPtyForkOptions,
    longSessionId?: string,
  ): any {
    // 切割sessionId到短Id
    const sessionId = longSessionId?.split('|')?.[1];
    this.debugLogger.log('ptyServiceProxy: spawn sessionId:', sessionId);
    let ptyInstance: pty.IPty | undefined;
    if (sessionId) {
      // 查询SessionId对应的Pid
      const pid = this.ptySessionMap.get(sessionId) || -10;
      // 查询Pid是否存活
      const checkResult = pid > 0 ? this.checkProcess(pid) : false;
      this.debugLogger.debug('ptyServiceProxy: check process result:', pid, checkResult);
      if (checkResult) {
        ptyInstance = this.ptyInstanceMap.get(pid);
      } else {
        // 有Session ID 但是没有 Process，说明是被系统杀了，此时需要重新spawn一个Pty
        this.ptyInstanceMap.delete(pid);
        ptyInstance = pty.spawn(file, args, options);
        // 这种情况下，需要把之前的PtyCache给attach上去，方便用户查看记录
        const oldLineCache = this.ptyDataCacheMap.get(pid);
        if (oldLineCache) {
          this.ptyDataCacheMap.set(ptyInstance.pid, oldLineCache);
          this.ptyDataCacheMap.delete(pid);
        }
      }
    }

    // 如果不存在ptyInstance的话，则重新创建一个，兜底用，理论上不会走到这里
    if (!ptyInstance) {
      ptyInstance = pty.spawn(file, args, options);
    }

    this.ptyInstanceMap.set(ptyInstance.pid, ptyInstance);
    if (sessionId) {
      this.ptySessionMap.set(sessionId, ptyInstance.pid);
    }

    const pid = ptyInstance.pid;
    // 初始化PtyLineCache
    if (!this.ptyDataCacheMap.has(pid)) {
      this.ptyDataCacheMap.set(pid, new PtyLineDataCache());
    }
    // 初始化ptyDisposableMap
    if (!this.ptyDisposableMap.has(pid)) {
      this.ptyDisposableMap.set(pid, new DisposableCollection());
    } else {
      // 如果已经存在DisposableCollection说明之前已经注册过，此时就需要取消注册，因为一会还要注册一遍
      this.ptyDisposableMap.get(pid)?.dispose();
    }

    // 走RPC序列化的部分，function不走序列化，走单独的RPC调用
    const ptyInstanceSimple = {
      pid: ptyInstance.pid,
      cols: ptyInstance.cols,
      rows: ptyInstance.rows,
      process: ptyInstance.process,
      handleFlowControl: ptyInstance.handleFlowControl,
    };
    this.debugLogger.log('ptyServiceProxy: spawn', ptyInstanceSimple);
    return ptyInstanceSimple;
  }

  $onData(callId: number, pid: number): void {
    this.debugLogger.debug('ptyServiceCenter $onData: callId: ', callId, ' pid: ', pid);
    const ptyInstance = this.ptyInstanceMap.get(pid);
    const cache = this.ptyDataCacheMap.get(pid);
    cache?.data.forEach((value) => {
      this.$callback(callId, value);
    });

    const onDataDisposable = ptyInstance?.onData((e) => {
      this.debugLogger.debug('ptyServiceCenter: onData', JSON.stringify(e), 'pid:', pid, 'callId', callId);
      if (typeof e === 'string') {
        // 缓存数据的时候只存放前1024个字符，因为正常情况下也不会超过1024个，如果超过的话，基本上是用户误操作导致的cat 二进制文件或者其他未知问题
        // 比如说某个程序一直通过CSI转义命令来以用户不可见的方式增加终端输出内容
        // 缓存限制在每行1024字符来避免潜在的内存泄漏问题
        cache?.add(e.slice(0, 1024));
      }
      this.$callback(callId, e);
    });

    if (onDataDisposable) {
      this.ptyDisposableMap.get(pid)?.push(onDataDisposable);
    }
  }

  $onExit(callId: number, pid: number): void {
    const ptyInstance = this.ptyInstanceMap.get(pid);
    const onExitDisposable = ptyInstance?.onExit((e) => {
      this.debugLogger.debug('ptyServiceCenter: onExit', 'pid:', pid, e);
      this.$callback(callId, e);
    });
    if (onExitDisposable) {
      this.ptyDisposableMap.get(pid)?.push(onExitDisposable);
    }
  }

  $on(callId: number, pid: number, event: any): void {
    const ptyInstance = this.ptyInstanceMap.get(pid);
    ptyInstance?.on(event, (e) => {
      this.$callback(callId, e);
    });
  }

  $resize(pid: number, columns: number, rows: number): void {
    const ptyInstance = this.ptyInstanceMap.get(pid);
    ptyInstance?.resize(columns, rows);
  }

  $write(pid: number, data: string): void {
    const ptyInstance = this.ptyInstanceMap.get(pid);
    this.debugLogger.debug('ptyServiceCenter: write', JSON.stringify(data), 'pid:', pid);
    ptyInstance?.write(data);
  }

  $kill(pid: number, signal?: string): void {
    this.debugLogger.debug('ptyServiceCenter: kill', 'pid:', pid);
    const ptyInstance = this.ptyInstanceMap.get(pid);
    ptyInstance?.kill(signal);
    this.ptyInstanceMap.delete(pid);
    this.ptyDataCacheMap.delete(pid);
  }

  $pause(pid: number): void {
    const ptyInstance = this.ptyInstanceMap.get(pid);
    ptyInstance?.pause();
  }

  $resume(pid: number): void {
    const ptyInstance = this.ptyInstanceMap.get(pid);
    ptyInstance?.resume();
  }

  $getProcess(pid: number): string {
    const ptyInstance = this.ptyInstanceMap.get(pid);
    return ptyInstance?.process || '';
  }
}

// 需要单独运行PtyServer的时候集成此Class然后运行initServer
export class PtyServiceProxyRPCProvider {
  private ptyServiceProxy: PtyServiceProxy;
  private readonly ptyServiceCenter: RPCServiceCenter;
  private readonly debugLogger = getDebugLogger();
  private serverListenOptions: ListenOptions; // HOST + PORT or UNIX SOCK PATH
  private server: Server;

  constructor(listenOptions: ListenOptions = { port: PTY_SERVICE_PROXY_SERVER_PORT }) {
    this.serverListenOptions = listenOptions;
    this.ptyServiceCenter = new RPCServiceCenter();
    const { createRPCService, getRPCService } = initRPCService(this.ptyServiceCenter);
    const $callback: (callId: number, ...args) => void = (getRPCService(PTY_SERVICE_PROXY_CALLBACK_PROTOCOL) as any)
      .$callback;

    this.ptyServiceProxy = new PtyServiceProxy($callback);

    createRPCService(PTY_SERVICE_PROXY_PROTOCOL, this.ptyServiceProxy);
  }

  public initServer() {
    this.createSocket();
    this.bindProcessHandler();
  }

  private createSocket() {
    this.server = net.createServer();
    this.server.on('connection', (connection) => {
      this.debugLogger.log('ptyServiceCenter: new connections coming in');
      this.setProxyConnection(connection);
    });
    // const ipcPath = normalizedIpcHandlerPath()
    if (this.serverListenOptions.path && fs.existsSync(this.serverListenOptions.path)) {
      // UNIX DOMAIN SOCKET
      fs.unlinkSync(this.serverListenOptions.path); // 兜底逻辑，如果之前Server没有清除掉SOCK文件的话，那就先清除
    }
    this.server.listen(this.serverListenOptions);
    this.debugLogger.log('ptyServiceCenter: listening on', this.serverListenOptions);
  }

  // Close Server, release UNIX DOMAIN SOCKET
  private bindProcessHandler() {
    // Handles normal process termination.
    process.on('exit', () => {
      this.server.close();
    });
    // Handles `Ctrl+C`.
    process.on('SIGINT', async () => {
      process.exit(0);
    });
    // Handles `kill pid`.
    process.on('SIGTERM', async () => {
      process.exit(0);
    });
  }

  private setProxyConnection(connection: net.Socket) {
    const serverConnection = createSocketConnection(connection);
    this.ptyServiceCenter.setConnection(serverConnection);
    connection.on('close', () => {
      this.ptyServiceCenter.removeConnection(serverConnection);
    });
  }

  public get $ptyServiceProxy(): PtyServiceProxy {
    return this.ptyServiceProxy;
  }
}
