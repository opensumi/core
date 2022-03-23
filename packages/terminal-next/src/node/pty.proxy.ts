/* eslint-disable no-console */
import net from 'net';

import * as pty from 'node-pty';

import { RPCServiceCenter, initRPCService } from '@opensumi/ide-connection';
import { createSocketConnection } from '@opensumi/ide-connection/lib/node';
import { getDebugLogger } from '@opensumi/ide-core-node';

import {
  IPtyProxyRPCService,
  PTY_SERVICE_PROXY_CALLBACK_PROTOCOL,
  PTY_SERVICE_PROXY_PROTOCOL,
  PTY_SERVICE_PROXY_SERVER_PORT,
} from '../common';

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

class PtyServiceProxy {
  private readonly ptyServiceCenter: RPCServiceCenter;
  // Map <pid, pty>
  private ptyInstanceMap = new Map<PID, pty.IPty>();
  private ptySessionMap = new Map<SessionId, PID>();
  private ptyDataCacheMap = new Map<PID, PtyLineDataCache>();
  private readonly debugLogger = getDebugLogger();

  constructor() {
    this.ptyServiceCenter = new RPCServiceCenter();
    const { createRPCService, getRPCService } = initRPCService(this.ptyServiceCenter);

    const $callback: (callId: number, ...args) => void = (getRPCService(PTY_SERVICE_PROXY_CALLBACK_PROTOCOL) as any)
      .$callback;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    // Pty 服务的RPC Service创建
    const ptyServiceProxyInstance: IPtyProxyRPCService = {
      $spawn(
        file: string,
        args: string[] | string,
        options: pty.IPtyForkOptions | pty.IWindowsPtyForkOptions,
        longSessionId?: string,
      ): any {
        const sessionId = longSessionId?.split('|')?.[1];
        self.debugLogger.log('ptyServiceProxy: spawn sessionId:', sessionId);
        let ptyInstance: pty.IPty | undefined;
        if (sessionId) {
          // 查询SessionId对应的Pid
          const pid = self.ptySessionMap.get(sessionId) || -10;
          // 查询Pid是否存活
          const checkResult = pid > 0 ? self.checkProcess(pid) : false;
          self.debugLogger.debug('ptyServiceProxy: check process result:', pid, checkResult);
          if (checkResult) {
            ptyInstance = self.ptyInstanceMap.get(pid);
          } else {
            self.ptyInstanceMap.delete(pid);
          }
        }

        if (!ptyInstance) {
          ptyInstance = pty.spawn(file, args, options);
        }

        self.ptyInstanceMap.set(ptyInstance.pid, ptyInstance);
        if (sessionId) {
          self.ptySessionMap.set(sessionId, ptyInstance.pid);
        }
        const pid = ptyInstance.pid;
        // 初始化PtyLineCache
        if (!self.ptyDataCacheMap.has(pid)) {
          self.ptyDataCacheMap.set(pid, new PtyLineDataCache());
        }

        // 走RPC序列化的部分，function不走序列化，走单独的RPC调用
        const ptyInstanceSimple = {
          pid: ptyInstance.pid,
          cols: ptyInstance.cols,
          rows: ptyInstance.rows,
          process: ptyInstance.process,
          handleFlowControl: ptyInstance.handleFlowControl,
        };
        self.debugLogger.log('ptyServiceProxy: spawn', ptyInstanceSimple);
        return ptyInstanceSimple;
      },
      $onData(callId: number, pid: number): void {
        self.debugLogger.debug('ptyServiceCenter $onData: callId: ', callId, ' pid: ', pid);
        const ptyInstance = self.ptyInstanceMap.get(pid);
        const cache = self.ptyDataCacheMap.get(pid);
        cache?.data.forEach((value) => {
          $callback(callId, value);
        });
        if (cache?.data.length && cache?.data.length > 0) {
          // $callback(callId, 'TERMINAL RESTORE/n');
        }

        ptyInstance?.onData((e) => {
          self.debugLogger.debug('ptyServiceCenter: onData', e, 'pid:', pid, 'callId', callId);
          cache?.add(e);
          $callback(callId, e);
        });
      },
      $onExit(callId: number, pid: number): void {
        const ptyInstance = self.ptyInstanceMap.get(pid);
        ptyInstance?.onExit((e) => {
          self.debugLogger.debug('ptyServiceCenter: onExit', 'pid:', pid, e);
          $callback(callId, e);
        });
      },
      $on(callId: number, pid: number, event: any): void {
        const ptyInstance = self.ptyInstanceMap.get(pid);
        ptyInstance?.on(event, (e) => {
          $callback(callId, e);
        });
      },
      $resize(pid: number, columns: number, rows: number): void {
        const ptyInstance = self.ptyInstanceMap.get(pid);
        ptyInstance?.resize(columns, rows);
      },
      $write(pid: number, data: string): void {
        const ptyInstance = self.ptyInstanceMap.get(pid);
        self.debugLogger.debug('ptyServiceCenter: write', data, 'pid:', pid);
        ptyInstance?.write(data);
      },
      $kill(pid: number, signal?: string): void {
        self.debugLogger.debug('ptyServiceCenter: kill', 'pid:', pid);
        // TODO: 因为要保活，暂时屏蔽Kill，后续寻找更好的办法
        // const ptyInstance = self.ptyInstanceMap.get(pid);
        // ptyInstance?.kill(signal);
        // self.ptyInstanceMap.delete(pid);
        // self.ptyDataCacheMap.delete(pid);
      },
      $pause(pid: number): void {
        const ptyInstance = self.ptyInstanceMap.get(pid);
        ptyInstance?.pause();
      },
      $resume(pid: number): void {
        const ptyInstance = self.ptyInstanceMap.get(pid);
        ptyInstance?.resume();
      },
    };

    createRPCService(PTY_SERVICE_PROXY_PROTOCOL, ptyServiceProxyInstance);
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

  public initServer() {
    this.createSocket();
  }

  private createSocket() {
    const server = net.createServer();
    server.on('connection', (connection) => {
      this.debugLogger.log('ptyServiceCenter: new connections coming in');
      this.setProxyConnection(connection);
    });
    server.listen(PTY_SERVICE_PROXY_SERVER_PORT);
    this.debugLogger.log(`ptyServiceCenter: listening on ${PTY_SERVICE_PROXY_SERVER_PORT}`);
  }

  private setProxyConnection(connection: net.Socket) {
    const serverConnection = createSocketConnection(connection);
    this.ptyServiceCenter.setConnection(serverConnection);
    connection.on('close', () => {
      this.ptyServiceCenter.removeConnection(serverConnection);
    });
  }
}

const proxy = new PtyServiceProxy();
proxy.initServer();
console.log('ptyServiceCenter: init');
