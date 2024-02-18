import { IExtensionHostManager } from '../../src';
import { ExtensionHostManager } from '../../src/node/extension.host.manager';

import { extensionHostManagerTester } from './extension.host.manager.common-tester';

extensionHostManagerTester({
  name: 'ext host manager',
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
