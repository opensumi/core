import { createNodeInjector, disposeAll } from '@opensumi/ide-dev-tool/src/mock-injector';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { AddonsModule } from '../../src/node';

describe('test for ', () => {
  let injector: MockInjector;

  beforeEach(() => {
    injector = createNodeInjector([AddonsModule]);
  });

  afterEach(() => {
    return disposeAll(injector);
  });

  it('empty module', () => {
    const ins = injector.get(AddonsModule);
    expect(ins.providers.length).toBe(2);
  });
});
