import net, { SocketConnectOpts } from 'net';

import { Injectable, Optional } from '@opensumi/di';
import { RPCServiceCenter, initRPCService } from '@opensumi/ide-connection';
import { createSocketConnection } from '@opensumi/ide-connection/lib/node';

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

  private initRemoteConnectionMode(connectOpts: SocketConnectOpts) {
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
    socket.connect(connectOpts);

    // 连接绑定
    clientCenter.setConnection(createSocketConnection(socket));
    return getService;
  }

  protected initLocal() {
    // override 空置父类的方法，因为不需要LocalInit，使用RemoteInit替代
  }
}
