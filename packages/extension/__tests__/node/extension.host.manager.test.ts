import { IExtensionHostManager } from '../../src';
import { ExtensionHostManager } from '../../src/node/extension.host.manager';

import { extensionHostManagerTester } from './extension.host.manager.common-tester';

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
