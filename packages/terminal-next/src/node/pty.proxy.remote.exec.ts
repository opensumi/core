import { PtyServiceProxyRPCProvider } from './pty.proxy';

// 双容器模式下，需要以本文件作为 entry 单独打包出一个可执行文件，运行在 DEV 容器中
const proxyProvider = new PtyServiceProxyRPCProvider();
proxyProvider.initServer();
