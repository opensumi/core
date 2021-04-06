import { URI } from '@ali/ide-core-browser';
import { DebugResourceResolverContribution, DebugSource } from '@ali/ide-debug/lib/browser';
import { IDebugSessionManager } from '@ali/ide-debug';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';

describe('DebugResource', () => {
  let  contribution: DebugResourceResolverContribution;

  const mockDebugSessionManager = {
    currentSession: {
      toSource: jest.fn(() => ({
        load: () => ({}),
      })),
    },
  };

  const injector = createBrowserInjector([], new MockInjector([
    {
      token: DebugResourceResolverContribution,
      useClass: DebugResourceResolverContribution,
    },
    {
      token: IDebugSessionManager,
      useValue: mockDebugSessionManager,
    },
  ]));

  beforeAll(() => {
    contribution = injector.get(DebugResourceResolverContribution);
  });

  afterAll(() => {
    injector.disposeAll();
  });

  it('can resolve debug source uri', async () => {
    const resource = contribution.resolve(new URI('test.js').withScheme(DebugSource.SCHEME));
    expect(resource).toBeDefined();
    await resource.readContents();
    expect(mockDebugSessionManager.currentSession.toSource).toBeCalled();
  });

});
