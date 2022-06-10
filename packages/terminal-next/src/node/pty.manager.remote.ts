import net, { SocketConnectOpts } from 'net';

import { Injectable, Optional } from '@opensumi/di';
import { RPCServiceCenter, initRPCService } from '@opensumi/ide-connection';
import { createSocketConnection } from '@opensumi/ide-connection/lib/node';
import { Disposable, IDisposable } from '@opensumi/ide-core-common';

import {
  IPtyProxyRPCService,
  PTY_SERVICE_PROXY_CALLBACK_PROTOCOL,
  PTY_SERVICE_PROXY_PROTOCOL,
  PTY_SERVICE_PROXY_SERVER_PORT,
} from '../common';

import { PtyServiceManager } from './pty.manager';

// 双容器架构 - 在IDE容器中远程运行，与DEV Server上的PtyService通信
// 继承自PtyServiceManager，覆写了创建PtyProxyService连接的方法，用于需要远程连接PtyService的场景
// 具体需要根据应用场景，通过DI注入覆盖PtyServiceManager使用
@Injectable()
export class PtyServiceManagerRemote extends PtyServiceManager {
  // Pty运行在单独的容器上，通过Socket连接，可以自定义Socket连接参数
  constructor(@Optional() connectOpts: SocketConnectOpts = { port: PTY_SERVICE_PROXY_SERVER_PORT }) {
    super();
    this.initRemoteConnectionMode(connectOpts);
  }

  private initRPCService(socket: net.Socket): IDisposable {
    const clientCenter = new RPCServiceCenter();
    const { getRPCService: clientGetRPCService, createRPCService } = initRPCService(clientCenter);
    const getService: IPtyProxyRPCService = clientGetRPCService(PTY_SERVICE_PROXY_PROTOCOL) as any;
    this.ptyServiceProxy = getService;
    let callbackDisposed = false;

    // 处理回调
    createRPCService(PTY_SERVICE_PROXY_CALLBACK_PROTOCOL, {
      $callback: async (callId, ...args) => {
        if (callbackDisposed) {
          // 在这里做一下Dispose的处理，在Dispose之后回调不再被执行
          // TODO: 但是按照我的理解，在removeConnection之后这里就完全不应该被执行，但却被执行了，是为什么呢？
          return;
        }
        const callback = this.callbackMap.get(callId);
        if (!callback) {
          // 这里callbackMap的callId对应的回调方法被注销，但是依然被调用了，这种情况不应该发生
          this.logger.warn('PtyServiceManager not found callback:', callId);
        } else {
          callback(...args);
        }
      },
    });

    const messageConnection = createSocketConnection(socket);
    clientCenter.setConnection(messageConnection);
    return Disposable.create(() => {
      callbackDisposed = true;
      clientCenter.removeConnection(messageConnection);
    });
  }

  private initRemoteConnectionMode(connectOpts: SocketConnectOpts) {
    const socket = new net.Socket();
    let rpcServiceDisposable: IDisposable | undefined;

    // UNIX Socket 连接监听，成功连接后再创建RPC服务
    socket.on('connect', () => {
      this.logger.log('PtyServiceManagerRemote connected');
      rpcServiceDisposable?.dispose();
      rpcServiceDisposable = this.initRPCService(socket);
    });

    // UNIX Socket 连接失败或者断开，此时需要等待 1.5s 后重新连接
    socket.on('close', () => {
      this.logger.log('PtyServiceManagerRemote connect failed, will reconnect after 2s');
      rpcServiceDisposable?.dispose();
      global.setTimeout(() => {
        try {
          socket.connect(connectOpts);
        } catch (e) {
          this.logger.warn(e);
        }
      }, 2000);
    });

    // 处理 Socket 异常
    socket.on('error', (e) => {
      this.logger.warn(e);
    });

    try {
      socket.connect(connectOpts);
    } catch (e) {
      // 连接错误的时候会抛出异常，此时自动重连，同时需要 catch 错误
      this.logger.warn(e);
    }
  }

  protected initLocal() {
    // override 空置父类的方法，因为不需要LocalInit，使用RemoteInit替代
  }
}
