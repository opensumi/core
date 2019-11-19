import { URI, Disposable, DisposableCollection, IFileServiceClient, IContextKeyService, createContributionProvider } from '@ali/ide-core-browser';
import { createNodeInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { DebugModule, DebugAdapterContributionRegistry } from '@ali/ide-debug/lib/node';
import { DebugService } from '../../lib/browser/debug-service';
import { DebugServer, DebugAdapterContribution } from '@ali/ide-debug';

process.on('unhandledRejection', (reason, promise) => {
  console.error(reason);
});

describe('Debug Model', () => {

  let injector: MockInjector;
  let debugServer: DebugServer;
  let registry: DebugAdapterContributionRegistry;

  const toTearDown = new DisposableCollection();

  const initializeInjector = async () => {

    injector = createNodeInjector([
      DebugModule,
    ]);
    createContributionProvider(injector, DebugAdapterContribution);
    debugServer = injector.get(DebugServer);
    registry = injector.get(DebugAdapterContributionRegistry);
  };

  beforeEach(() => {
    return initializeInjector();
  });

  afterEach(() => toTearDown.dispose());

  it('debugService simple test', async (done) => {
    expect(await debugServer.getConfigurationSnippets()).toEqual([]);
    expect(await debugServer.getDebuggersForLanguage('ts')).toEqual([]);
    expect(await debugServer.getSchemaAttributes('debug')).toEqual([]);
    done();
  });

});
