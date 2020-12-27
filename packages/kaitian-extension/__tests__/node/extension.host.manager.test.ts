import { extensionHostManagerTester } from './extension.host.manager.common-tester';
import { IExtensionHostManager } from '../../src';
import { ExtensionHostManager } from '../../src/node/extension.host.manager';

extensionHostManagerTester({
  providers: [
    {
      token: IExtensionHostManager,
      useClass: ExtensionHostManager,
    },
  ],
  init: () => {
    // noop
  },
  dispose: () => {
    // noop
  },
});
