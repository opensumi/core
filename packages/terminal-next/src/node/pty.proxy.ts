/* eslint-disable no-console */
import net from 'net';
import * as pty from 'node-pty';
import { RPCServiceCenter, createSocketConnection, initRPCService } from '@opensumi/ide-connection';

export interface IPtyServiceProxy {
  $spawn(
    file: string,
    args: string[] | string,
    options: pty.IPtyForkOptions | pty.IWindowsPtyForkOptions,
  ): Promise<pty.IPty>;
  $onData(callId: number, pid: number): void;
  $onExit(callId: number, pid: number): void;
  $on(callId: number, pid: number, event: any): void;
  $resize(pid: number, columns: number, rows: number): void;
  $write(pid: number, data: string): void;
  $kill(pid: number, signal?: string): void;
  $pause(pid: number): void;
  $resume(pid: number): void;
}

// 在DEV容器中远程运行，与IDE Server通信
class PtyServiceProxy {
  private readonly ptyServiceCenter: RPCServiceCenter;
  private ptyInstanceMap = new Map<number, pty.IPty>();

  constructor() {
    this.ptyServiceCenter = new RPCServiceCenter();
    this.createSocket();
    const { createRPCService, getRPCService } = initRPCService(this.ptyServiceCenter);

    const $callback: (callId: number, ...args) => void = (getRPCService('PTY_SERVICE_Callback') as any).$callback;
    const self = this;
    const ptyServiceProxy: IPtyServiceProxy = {
      $spawn(file: string, args: string[] | string, options: pty.IPtyForkOptions | pty.IWindowsPtyForkOptions): any {
        console.log('ptyServiceCenter: spawn', file, args, options);
        const ptyInstance = pty.spawn(file, args, options);
        self.ptyInstanceMap.set(ptyInstance.pid, ptyInstance);
        const ptyInstanceSimple = {
          pid: ptyInstance.pid,
          cols: ptyInstance.cols,
          rows: ptyInstance.rows,
          process: ptyInstance.process,
          handleFlowControl: ptyInstance.handleFlowControl,
        };
        console.log('ptyServiceCenter: spawn', ptyInstanceSimple);
        return ptyInstanceSimple;
        // (getRPCService('PTY_SERVICE_Callback') as any).$callback('call back test');
      },
      $onData(callId: number, pid: number): void {
        const ptyInstance = self.ptyInstanceMap.get(pid);
        ptyInstance?.onData((e) => {
          console.log('ptyServiceCenter: onData', e, 'pid:', pid);
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
        console.log('ptyServiceCenter: write', data, 'pid:', pid);
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

    createRPCService('PTY_SERVICE', ptyServiceProxy);
  }

  private createSocket() {
    const server = net.createServer();
    server.on('connection', (connection) => {
      console.log('ptyServiceCenter: new connections coming in');
      this.setProxyConnection(connection);
    });
    server.listen(10111);
    console.log('ptyServiceCenter: listening on 10111');
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
