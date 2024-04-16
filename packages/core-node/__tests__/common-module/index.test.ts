import { ICommonServer } from '@opensumi/ide-core-common';
import { ServerCommonModule } from '@opensumi/ide-core-node';
import { CommonServer } from '@opensumi/ide-core-node/lib/common-module/common.server';
import { createNodeInjector } from '@opensumi/ide-dev-tool/src/mock-injector';

import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';

describe('NodeLogger', () => {
  let server: CommonServer;
  let injector: MockInjector;

  beforeAll(() => {
    injector = createNodeInjector([ServerCommonModule]);
    server = injector.get(ICommonServer);
  });

  afterAll(async () => {
    await injector.disposeAll();
  });

  test('getBackendOS', async () => {
    expect(typeof (await server.getBackendOS())).toBe('number');
  });
});
