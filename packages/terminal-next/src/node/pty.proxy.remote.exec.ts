import { PTY_SERVICE_PROXY_SERVER_PORT } from '../common/pty';

import { PtyServiceProxyRPCProvider } from './pty.proxy';

// 双容器模式下，需要以本文件作为 entry 单独打包出一个可执行文件，运行在 DEV 容器中
const listenOptions = process.env.PTY_PROXY_SOCK
  ? { path: process.env.PTY_PROXY_SOCK }
  : {
      port: Number(process.env.PTY_PROXY_PORT || PTY_SERVICE_PROXY_SERVER_PORT),
      host: process.env.PTY_PROXY_HOST,
    };

const proxyProvider = new PtyServiceProxyRPCProvider(listenOptions);
proxyProvider.initServer();
