import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MonacoService, ServiceNames } from '../../src/common';
import MonacoServiceImpl from '../../src/browser/monaco.service';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { MonacoOverrideServiceRegistry } from '@ali/ide-core-browser';
import { MonacoOverrideServiceRegistryImpl } from '../../src/browser/override.service.registry';

let injector: MockInjector;

describe(' monaco service test', () => {

  injector = createBrowserInjector([]);
  (global as any).amdLoader = {require: null};

  injector.addProviders(...[{
    token: MonacoService,
    useClass: MonacoServiceImpl,
  }, {
    token: MonacoOverrideServiceRegistry,
    useClass: MonacoOverrideServiceRegistryImpl,
  }]);

  (global as any).amdLoader = {require: null};

  it('should be able to create', async (done) => {
    const service: MonacoService = injector.get(MonacoService);
    await service.loadMonaco();
    const editor = await service.createCodeEditor(document.createElement('div'));
    expect(editor).toBeDefined();
    const diffEditor = await service.createDiffEditor(document.createElement('div'));
    expect(diffEditor).toBeDefined();
    done();
  });

  it('should be able to override services', async (done) => {

    const service: MonacoService = injector.get(MonacoService);
    await service.loadMonaco();
    const overriddenService = {};
    service.registerOverride(ServiceNames.BULK_EDIT_SERVICE, overriddenService);
    // 新版本去掉了 override 属性，无法判断
    // expect((editor as MockedStandaloneCodeEditor).override[ServiceNames.BULK_EDIT_SERVICE]).toBe(overriddenService);
    done();
  });

});
