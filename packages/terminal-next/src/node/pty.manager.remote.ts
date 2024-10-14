import net, { SocketConnectOpts } from 'net';

import { Injectable, Optional } from '@opensumi/di';
import { RPCServiceCenter, initRPCService } from '@opensumi/ide-connection';
import { SumiConnection } from '@opensumi/ide-connection/lib/common/rpc/connection';
import { DebugLog, Disposable, IDisposable } from '@opensumi/ide-core-common';

import {
  IPtyProxyRPCService,
  PTY_SERVICE_PROXY_CALLBACK_PROTOCOL,
  PTY_SERVICE_PROXY_PROTOCOL,
  PTY_SERVICE_PROXY_SERVER_PORT,
} from '../common';

import { PtyServiceManager } from './pty.manager';

interface PtyServiceOptions {
  socketConnectOpts: SocketConnectOpts;
  /**
   * 重连时间间隔
   */
  reconnectInterval?: number;
  /**
   * socket 超时时间
   */
  socketTimeout?: number | undefined;
}

export const PtyServiceManagerRemoteOptions = Symbol('PtyServiceManagerRemoteOptions');

// 双容器架构 - 在IDE容器中远程运行，与DEV Server上的PtyService通信
// 继承自PtyServiceManager，覆写了创建PtyProxyService连接的方法，用于需要远程连接PtyService的场景
// 具体需要根据应用场景，通过DI注入覆盖PtyServiceManager使用
@Injectable()
export class PtyServiceManagerRemote extends PtyServiceManager {
  private disposer: Disposable;

  // Pty运行在单独的容器上，通过Socket连接，可以自定义Socket连接参数
  constructor(
    @Optional(PtyServiceManagerRemoteOptions)
    opts: PtyServiceOptions = { socketConnectOpts: { port: PTY_SERVICE_PROXY_SERVER_PORT } },
  ) {
    super();
    this.initRemoteConnectionMode(opts);
  }

  private initRPCService(socket: net.Socket): IDisposable {
    const clientCenter = new RPCServiceCenter();
    const { getRPCService: clientGetRPCService, createRPCService } = initRPCService(clientCenter);
    const getService: IPtyProxyRPCService = clientGetRPCService(PTY_SERVICE_PROXY_PROTOCOL) as any;
    this.ptyServiceProxy = getService;
    this.ptyServiceProxyDeferred.resolve();
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

    const connection = SumiConnection.forNetSocket(socket, {
      logger: this.logger,
    });
    const remove = clientCenter.setSumiConnection(connection);
    return Disposable.create(() => {
      callbackDisposed = true;
      remove.dispose();
    });
  }

  private initRemoteConnectionMode(opts: PtyServiceOptions) {
    const { socketTimeout, reconnectInterval, socketConnectOpts } = opts;
    if (this.disposer) {
      this.disposer.dispose();
    }
    this.disposer = new Disposable();

    const socket = new net.Socket();
    if (socketTimeout) {
      socket.setTimeout(socketTimeout);
    }

    let reconnectTimer: NodeJS.Timeout | null = null;
    const reconnect = () => {
      if (reconnectTimer) {
        return;
      }
      reconnectTimer = setTimeout(() => {
        this.logger.log('PtyServiceManagerRemote reconnect');
        socket.destroy();
        this.initRemoteConnectionMode(opts);
      }, reconnectInterval || 2000);
    };

    // UNIX Socket 连接监听，成功连接后再创建RPC服务
    socket.once('connect', () => {
      this.logger.log('PtyServiceManagerRemote connected');
      if (socketTimeout) {
        socket.setTimeout(0);
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      this.disposer.addDispose(this.initRPCService(socket));
    });

    // UNIX Socket 连接失败或者断开，此时需要等待 1.5s 后重新连接
    socket.on('close', (hadError) => {
      this.logger.log('PtyServiceManagerRemote socket close, hadError:', hadError);
      reconnect();
    });

    // 处理 Socket 异常
    socket.on('error', (e) => {
      this.logger.warn('PtyServiceManagerRemote socket error ', e);
    });

    socket.on('end', () => {
      this.logger.log('PtyServiceManagerRemote socket end');
    });

    socket.on('timeout', () => {
      this.logger.log('PtyServiceManagerRemote socket timeout');
      reconnect();
    });

    try {
      this.logger.log('PtyServiceManagerRemote socket start connect');
      socket.connect(socketConnectOpts);
    } catch (e) {
      // 连接错误的时候会抛出异常，此时自动重连，同时需要 catch 错误
      this.logger.warn('PtyServiceManagerRemote socket connect error', e);
    }
  }

  override initLocal() {
    // override 空置父类的方法，因为不需要LocalInit，使用RemoteInit替代
  }
}
