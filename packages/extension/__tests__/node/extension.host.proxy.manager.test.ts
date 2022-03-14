import { Event } from '@opensumi/ide-core-common';

import { IExtensionHostManager } from '../../src';
import { ExtHostProxy } from '../../src/hosted/ext.host.proxy-base';
import { ExtensionHostProxyManager } from '../../src/node/extension.host.proxy.manager';

import { extensionHostManagerTester } from './extension.host.manager.common-tester';

const PROXY_PORT = 10297;
let extHostProxy: ExtHostProxy;

extensionHostManagerTester({
  providers: [
    {
      token: IExtensionHostManager,
      useFactory(injector) {
        return injector.get(ExtensionHostProxyManager, [
          {
            port: PROXY_PORT,
          },
        ]);
      },
    },
  ],
  init: () =>
    new Promise((resolve) => {
      // 启动插件进程管理进程
      extHostProxy = new ExtHostProxy({
        socketConnectOpts: {
          port: PROXY_PORT,
        },
      });
      Event.once(extHostProxy.onConnected)(() => resolve());
      // 监听插件进程后端服务
      extHostProxy.init();
    }),
  dispose: () => {
    extHostProxy.dispose();
  },
});
