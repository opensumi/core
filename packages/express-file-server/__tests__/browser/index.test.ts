import { URI, createContributionProvider } from '@opensumi/ide-core-browser';
import {
  StaticResourceClientAppContribution,
  StaticResourceContribution,
  StaticResourceService,
} from '@opensumi/ide-core-browser/lib/static-resource';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';

import { ExpressFileServerModule } from '../../src/browser';

describe('packages/express-file-server/__tests__/browser/index.test.ts', () => {
  const injector = createBrowserInjector([ExpressFileServerModule]);

  const staticResourceService = injector.get<StaticResourceService>(StaticResourceService);
  const staticResourceClientAppContribution = injector.get<StaticResourceClientAppContribution>(
    StaticResourceClientAppContribution,
  );

  // 手动注册 staticResource 的 contribution provider
  createContributionProvider(injector, StaticResourceContribution);
  // 手动执行 staticResource 的 contribution
  staticResourceClientAppContribution.initialize();
  it('User express module to transform URI', () => {
    const uri = staticResourceService.resolveStaticResource(URI.file('test'));
    expect(uri.toString()).toEqual('http://127.0.0.1:8000/assets/test');
  });
});
