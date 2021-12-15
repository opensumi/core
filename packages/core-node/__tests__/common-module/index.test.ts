import { createNodeInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { ServerCommonModule } from '@opensumi/ide-core-node';
import { ICommonServer } from '@opensumi/ide-core-common';
import { CommonServer } from '@opensumi/ide-core-node/lib/common-module/common.server';

describe('NodeLogger', () => {
  let server: CommonServer;
  let injector: MockInjector;

  beforeAll(() => {
    injector = createNodeInjector([ServerCommonModule]);
    server = injector.get(ICommonServer);
  });

  afterAll(() => {
    injector.disposeAll();
  });

  test('getBackendOS', async () => {
    expect(typeof (await server.getBackendOS())).toBe('string');
  });
});
