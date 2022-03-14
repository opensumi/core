import { createNodeInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { AddonsModule } from '../../src';

describe('test for ', () => {
  let injector: MockInjector;

  beforeEach(() => {
    injector = createNodeInjector([AddonsModule]);
  });

  it('empty module', () => {
    const ins = injector.get(AddonsModule);
    expect(ins.providers.length).toBe(1);
  });
});
