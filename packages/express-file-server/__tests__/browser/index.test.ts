import { createBrowserInjector } from '@ide-framework/ide-dev-tool/src/injector-helper';
import { StaticResourceModule, StaticResourceService, StaticResourceContribution, StaticResourceClientAppContribution } from '@ide-framework/ide-static-resource/lib/browser';
import { ExpressFileServerModule } from '../../src/browser';
import { URI, createContributionProvider } from '@ide-framework/ide-core-common';

describe('packages/express-file-server/__tests__/browser/index.test.ts', () => {
  const injector = createBrowserInjector([
    ExpressFileServerModule,
    StaticResourceModule,
  ]);

  const staticResourceService = injector.get<StaticResourceService>(StaticResourceService);
  const staticResourceClientAppContribution = injector.get<StaticResourceClientAppContribution>(StaticResourceClientAppContribution);

  // 手动注册 staticResource 的 contribution provider
  createContributionProvider(injector, StaticResourceContribution);
  // 手动执行 staticResource 的 contribution
  staticResourceClientAppContribution.initialize();
  it('express 模块提供 file schema 的 uri 转换', () => {
    const uri = staticResourceService.resolveStaticResource(URI.file('test'));
    expect(uri.toString()).toEqual('http://127.0.0.1:8000/assets/test');
  });
});
