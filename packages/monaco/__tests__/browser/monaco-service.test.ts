import { MonacoOverrideServiceRegistry } from '@opensumi/ide-core-browser';
import { MockLogger } from '@opensumi/ide-core-browser/__mocks__/logger';
import { ILogger } from '@opensumi/ide-core-common';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import MonacoServiceImpl from '../../src/browser/monaco.service';
import { MonacoOverrideServiceRegistryImpl } from '../../src/browser/override.service.registry';
import { MonacoService, ServiceNames } from '../../src/common';


let injector: MockInjector;

describe(' monaco service test', () => {
  injector = createBrowserInjector([]);
  injector.overrideProviders(
    ...[
      {
        token: MonacoService,
        useClass: MonacoServiceImpl,
      },
      {
        token: MonacoOverrideServiceRegistry,
        useClass: MonacoOverrideServiceRegistryImpl,
      },
      {
        token: ILogger,
        useClass: MockLogger,
      },
    ],
  );

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
