import { IExtensionHostManager } from '../../src';
import { ExtensionHostProxyManager } from '../../src/node/extension.host.proxy.manager';
import { ExtHostProxy } from '../../src/hosted/ext.host.proxy-base';
import { extensionHostManagerTester } from './extension.host.manager.common-tester';
import { Event } from '@ali/ide-core-common';

let extHostProxy: ExtHostProxy;

extensionHostManagerTester({
  providers: [
    {
      token: IExtensionHostManager,
      useClass: ExtensionHostProxyManager,
    },
  ],
  init: () => {
    return new Promise((resolve) => {
      // 启动插件进程管理进程
      extHostProxy = new ExtHostProxy();
      Event.once(extHostProxy.onConnected)(() => resolve());
      // 监听插件进程后端服务
      extHostProxy.init();
    });
  },
  dispose: () => {
    extHostProxy.dispose();
  },
});
