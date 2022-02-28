/* eslint-disable no-console */
import net from 'net';
import * as pty from 'node-pty';
import { RPCServiceCenter, createSocketConnection, initRPCService } from '@opensumi/ide-connection';
import { getDebugLogger } from '@opensumi/ide-core-node';
import {
  IPtyProxyRPCService,
  PTY_SERVICE_PROXY_CALLBACK_PROTOCOL,
  PTY_SERVICE_PROXY_PROTOCOL,
  PTY_SERVICE_PROXY_SERVER_PORT,
} from '../common';

// 在DEV容器中远程运行，与IDE Server通信
class PtyServiceProxy {
  private readonly ptyServiceCenter: RPCServiceCenter;
  private ptyInstanceMap = new Map<number, pty.IPty>();
  private readonly debugLogger = getDebugLogger();

  constructor() {
    this.ptyServiceCenter = new RPCServiceCenter();
    this.createSocket();
    const { createRPCService, getRPCService } = initRPCService(this.ptyServiceCenter);

    const $callback: (callId: number, ...args) => void = (getRPCService(PTY_SERVICE_PROXY_CALLBACK_PROTOCOL) as any)
      .$callback;
    const self = this;

    // Pty 服务的RPC Service创建
    const ptyServiceProxyInstance: IPtyProxyRPCService = {
      $spawn(file: string, args: string[] | string, options: pty.IPtyForkOptions | pty.IWindowsPtyForkOptions): any {
        const ptyInstance = pty.spawn(file, args, options);
        self.ptyInstanceMap.set(ptyInstance.pid, ptyInstance);
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
        const ptyInstance = self.ptyInstanceMap.get(pid);
        ptyInstance?.onData((e) => {
          self.debugLogger.debug('ptyServiceCenter: onData', e, 'pid:', pid);
          $callback(callId, e);
        });
      },
      $onExit(callId: number, pid: number): void {
        const ptyInstance = self.ptyInstanceMap.get(pid);
        ptyInstance?.onExit((e) => {
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
        const ptyInstance = self.ptyInstanceMap.get(pid);
        ptyInstance?.kill(signal);
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

new PtyServiceProxy();
