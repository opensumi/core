import { IExtensionHostManager } from '../../src';
import { ExtensionHostProxyManager } from '../../src/node/extension.host.proxy.manager';
import { ExtHostProxy } from '../../src/hosted/ext.host.proxy-base';
import { extensionHostManagerTester } from './extension.host.manager.common-tester';

let extHostProxy: ExtHostProxy;

extensionHostManagerTester({
  providers: [
    {
      token: IExtensionHostManager,
      useClass: ExtensionHostProxyManager,
    },
  ],
  beforeEachHead: () => {
    // 启动插件进程管理进程
    extHostProxy = new ExtHostProxy();
    // 监听插件进程后端服务
    extHostProxy.init();
  },
  afterEachHead: () => {
    extHostProxy.dispose();
  },
});
