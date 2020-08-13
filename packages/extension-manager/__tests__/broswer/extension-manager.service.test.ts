import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { IExtensionManagerService  } from '../../src/common';
import { ExtensionManagerModule } from '../../src/browser';
import { IContextKeyService, uuid } from '@ali/ide-core-browser';
import { MockContextKeyService } from '@ali/ide-monaco/lib/browser/mocks/monaco.context-key.service';
import { MockInjector } from '@ali/ide-dev-tool/src/mock-injector';
import { ExtensionService } from '@ali/ide-kaitian-extension';
import { ExtensionServiceImpl } from '@ali/ide-kaitian-extension/lib/browser/extension.service';
import { Disposable } from '@ali/ide-core-common';
import { ExtensionManagerServerPath } from '../../lib';
import { ExtensionManagerServer } from '../../lib/node/extension-manager-server';

describe('extension manager service test', () => {
  let injector: MockInjector;
  let extensionManagerService: IExtensionManagerService;

  beforeEach(async (done) => {
    injector = await createBrowserInjector([ ExtensionManagerModule ]);

    injector.addProviders({
      token: IContextKeyService,
      useClass: MockContextKeyService,
    }, {
      token: ExtensionService,
      useClass: ExtensionServiceImpl,
    }, {
      token: ExtensionManagerServerPath,
      useClass: ExtensionManagerServer,
    });

    injector.mockService(ExtensionService, {
      'getExtensionProps': (path) => {
        // @ts-ignore
        return extensionManagerService.extensions.find((ext) => ext.path === path);
      },
      onDidExtensionActivated: () => Disposable.NULL,
    });

    extensionManagerService = injector.get<IExtensionManagerService>(IExtensionManagerService);

    injector.mockService(ExtensionManagerServerPath, {
      'getExtensionFromMarketPlace': async (id) => {
        // @ts-ignore
        const target = extensionManagerService.extensions.find((ext) => ext.extensionId === id);
        return {
          data: {
            ...target,
            identifier: target.extensionId,
          },
        };
      },
    });

    done();
  });

  afterEach(() => {
    extensionManagerService.dispose();
  });

  const createFakeExtension = (opts = {}) => {
    const ext = {
      name: uuid(),
      enable: true,
      install: true,
      packageJSON: {},
      path: uuid(),
      id: uuid(),
      extensionId: uuid(),
      ...opts,
    };

    Object.assign(ext, { isUseEnable: ext.enable, realPath: ext.path });

    // @ts-ignore
    extensionManagerService.extensions.push(ext);
    return ext;
  };

  it('get enabled deps', async () => {

    const extA = createFakeExtension({
      enable: true,
      extensionId: 'a',
    });

    const extB = createFakeExtension({
      enable: true,
      extensionId: 'b',
      packageJSON: {
        extensionDependencies: [extA.extensionId],
      },
    });

    const extC = createFakeExtension({
      enable: true,
      extensionId: 'c',
    });

    const extD = createFakeExtension({
      enable: false,
      extensionId: 'd',
      packageJSON: {
        extensionDependencies: [extC.extensionId],
      },
    });

    createFakeExtension({
      enable: true,
      extensionId: 'e',
    });

    /**
    * A 是 B 的依赖，A 当前被激活
    * C 是 D 的依赖，D 当前没被激活
    * E 并非别人的依赖，E 当前被激活
    *
    * 则 return 的结果为 A - B
    *
    */
    expect(await extensionManagerService.getEnabledDeps())
      .toEqual(new Map(Object.entries({
        [extA.extensionId]: extB.extensionId,
      })));

    /**
     * 启用插件 F，依赖插件 D
     * 则此时的结果应该为 A - B, D - F
     */
    const extF = createFakeExtension({
      enable: true,
      extensionId: 'f',
      packageJSON: {
        extensionDependencies: [extD.extensionId],
      },
    });

    expect(await extensionManagerService.getEnabledDeps())
      .toEqual(new Map(Object.entries({
        [extA.extensionId]: extB.extensionId,
        [extD.extensionId]: extF.extensionId,
      })));
  });

});
