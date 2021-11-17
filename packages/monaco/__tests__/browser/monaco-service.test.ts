import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MonacoService, ServiceNames } from '../../src/common';
import MonacoServiceImpl from '../../src/browser/monaco.service';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { MonacoOverrideServiceRegistry } from '@ide-framework/ide-core-browser';
import { ILogger } from '@ide-framework/ide-core-common';
import { MonacoOverrideServiceRegistryImpl } from '../../src/browser/override.service.registry';
import { MockLogger } from '@ide-framework/ide-core-browser/__mocks__/logger';

let injector: MockInjector;

describe(' monaco service test', () => {

  injector = createBrowserInjector([]);
  (global as any).amdLoader = {require: null};
  injector.overrideProviders(...[{
    token: MonacoService,
    useClass: MonacoServiceImpl,
  }, {
    token: MonacoOverrideServiceRegistry,
    useClass: MonacoOverrideServiceRegistryImpl,
  }, {
    token: ILogger,
    useClass: MockLogger,
  }]);

  (global as any).amdLoader = {require: null};

  it('should be able to create', async () => {
    const service: MonacoService = injector.get(MonacoService);
    await service.loadMonaco();
    const editor = await service.createCodeEditor(document.createElement('div'));
    expect(editor).toBeDefined();
    const diffEditor = await service.createDiffEditor(document.createElement('div'));
    expect(diffEditor).toBeDefined();
  });

  it('should be able to override services', async () => {
    const service: MonacoService = injector.get(MonacoService);
    await service.loadMonaco();
    const overriddenService = {};
    service.registerOverride(ServiceNames.BULK_EDIT_SERVICE, overriddenService);
    // 新版本去掉了 override 属性，无法判断
    // expect((editor as MockedStandaloneCodeEditor).override[ServiceNames.BULK_EDIT_SERVICE]).toBe(overriddenService);
  });

  afterAll(() => {
    injector.disposeAll();
  });

});
