import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { EnableScope, IExtensionManagerService, IExtension } from '../../src/common';
import { ExtensionManagerModule } from '../../src/browser';
import { IContextKeyService, uuid } from '@ali/ide-core-browser';
import { MockContextKeyService } from '@ali/ide-monaco/lib/browser/mocks/monaco.context-key.service';
import { MockInjector } from '@ali/ide-dev-tool/src/mock-injector';
import { AbstractExtensionManagementService } from '@ali/ide-kaitian-extension';
import { StorageProvider, Uri } from '@ali/ide-core-common';
import { ExtensionManagementService } from '@ali/ide-kaitian-extension/src/browser/extension-management.service';
import { ExtensionManagerServerPath } from '../../lib';
import { ExtensionManagerServer } from '../../lib/node/extension-manager-server';
import { IStoragePathServer } from '@ali/ide-storage';
import { MockDatabaseStoragePathServer } from '../../../storage/__tests__/browser/index.test';
import { IFileServiceClient } from '@ali/ide-file-service';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';

describe('extension manager service test', () => {
  let injector: MockInjector;
  let extensionManagerService: IExtensionManagerService;
  let fakePostEnableExtension;
  let fakePostDisableExtension;
  let fakeInstallExtension;

  beforeEach(async () => {
    fakePostEnableExtension = jest.fn();
    fakePostDisableExtension = jest.fn();
    fakeInstallExtension = jest.fn();
    injector = createBrowserInjector([ ExtensionManagerModule ]);

    injector.addProviders({
      token: IContextKeyService,
      useClass: MockContextKeyService,
    }, {
      token: AbstractExtensionManagementService,
      useClass: ExtensionManagementService,
    }, {
      token: ExtensionManagerServerPath,
      useClass: ExtensionManagerServer,
    }, {
      token: IStoragePathServer,
      useClass: MockDatabaseStoragePathServer,
    }, {
      token: IFileServiceClient,
      useClass: FileServiceClient,
    });

    injector.mockService(AbstractExtensionManagementService, {
      'getExtensionProps': (path) => {
        // @ts-ignore
        return extensionManagerService.extensions.find((ext) => ext.path === path);
      },
      postEnableExtension: fakePostEnableExtension,
      postDisableExtension: fakePostDisableExtension,
      getAllExtensionJson: () => {
        // @ts-ignore
        return extensionManagerService.extensions;
      },
    });

    extensionManagerService = injector.get<IExtensionManagerService>(IExtensionManagerService);

    injector.mockService(StorageProvider, () => {
      return new Map();
    });

    injector.mockService(ExtensionManagerServerPath, {
      installExtension: fakeInstallExtension,
      getExtensionDeps: async (extensionId: string) => {
         // @ts-ignore
        const target: IExtension = extensionManagerService.extensions.find((ext) => ext.extensionId === extensionId);
        if (target) {
          return {
            data: {
              dependencies: target.packageJSON.extensionDependencies,
            },
          };
        }
      },
      getExtensionFromMarketPlace: async (id) => {
        // @ts-ignore
        const target = extensionManagerService.extensions.find((ext) => ext.extensionId === id);

        if (!target) {
          throw Error(`id: ${id} 404`);
        }

        return {
          data: {
            ...target,
            identifier: target?.extensionId,
          },
        };
      },
    });

    // 单测无法 watch 配置文件，mock 实现触发实际调用的 _toggleActiveExtension
    jest.spyOn(extensionManagerService, 'toggleActiveExtension').mockImplementation((...args) => (extensionManagerService as any)._toggleActiveExtension(...args));
  });

  afterEach(() => {
    extensionManagerService.dispose();
  });

  const createFakeExtension = (opts: Partial<IExtension>) => {
    const enabled = opts.isUseEnable ?? opts.enabled ?? true;
    const realPath = opts.realPath ?? opts.path ?? uuid();
    const publisher = opts?.packageJSON?.publisher;
    const name = opts?.packageJSON?.name;
    const id = publisher && name ? `${publisher}.${name}` : uuid();
    const ext: IExtension = {
      id,
      enableScope: EnableScope.GLOBAL,
      isBuiltin: false,
      name: uuid(),
      isUseEnable: enabled,
      enabled,
      installed: true,
      enableProposedApi: false,
      packageJSON: {},
      extendConfig: {},
      defaultPkgNlsJSON: {},
      realPath,
      packageNlsJSON: {},
      path: realPath,
      extensionId: uuid(),
      extraMetadata: {},
      activated: false,
      extensionLocation: Uri.file(realPath),
      ...opts,
    };
    // @ts-ignore
    extensionManagerService.extensions.push(ext);
    return ext;
  };

  it('get enabled deps', async () => {

    const extA = createFakeExtension({
      enabled: true,
      extensionId: 'a',
    });

    const extB = createFakeExtension({
      enabled: true,
      extensionId: 'b',
      packageJSON: {
        extensionDependencies: [extA.extensionId],
      },
    });

    const extC = createFakeExtension({
      enabled: true,
      extensionId: 'c',
    });

    const extD = createFakeExtension({
      enabled: false,
      extensionId: 'd',
      packageJSON: {
        extensionDependencies: [extC.extensionId],
      },
    });

    createFakeExtension({
      enabled: true,
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
      enabled: true,
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

  it('enable all extension', async () => {
    createFakeExtension({
      enabled: false,
      extensionId: 'a',
    });

    createFakeExtension({
      enabled: false,
      extensionId: 'b',
    });

    await extensionManagerService.enableAllExtensions();

    const extA = extensionManagerService.getRawExtensionById('a');
    const extB = extensionManagerService.getRawExtensionById('b');
    expect(extA?.enable).toBeTruthy();
    expect(extB?.enable).toBeTruthy();
  });

  it('disable all extension', async () => {
    createFakeExtension({
      enabled: true,
      extensionId: 'a',
    });

    createFakeExtension({
      enabled: true,
      extensionId: 'b',
    });

    await extensionManagerService.disableAllExtensions();

    const extA = extensionManagerService.getRawExtensionById('a');
    const extB = extensionManagerService.getRawExtensionById('b');
    expect(extA?.enable).toBeFalsy();
    expect(extB?.enable).toBeFalsy();
  });

  describe('Extension Pack', () => {
    it('禁用/启用 Pack, Pack 中的 Ext 也会对应的禁用/启用', async () => {
      createFakeExtension({ name: 'subA', packageJSON: { publisher: 'group' } });
      createFakeExtension({ name: 'subB', packageJSON: { publisher: 'group' } });
      const pack = createFakeExtension({ name: 'pack', packageJSON: {extensionPack: [
        'group.subA',
        'group.subB',
      ] }});
      const packExtension = extensionManagerService.getRawExtensionById(pack.extensionId)!;
      // 启用
      await extensionManagerService.toggleActiveExtension(packExtension, true, EnableScope.GLOBAL);

      expect(fakePostEnableExtension).toBeCalledTimes(3);

      // 禁用
      await extensionManagerService.toggleActiveExtension(packExtension, false, EnableScope.GLOBAL);

      // disable pack 时，同时会 disable pack 中的 ext
      expect(fakePostDisableExtension).toBeCalledTimes(3);
    });
  });

  describe('install extension', () => {
    it('如果依赖插件已经存在则不下载', async () => {
      // mock 一个 cloud-ide fork 的 java 插件
      const extensionManagerServer = injector.get(ExtensionManagerServerPath);
      // override 默认 service
      injector.mockService(ExtensionManagerServerPath, {
        ...extensionManagerServer,
        getExtensionFromMarketPlace: (id) => {
          // mock vscode.java 可以在 vscode-extensions 里找到
          if (id === 'vscode.java') {
            return {
              data: {
                identifier: 'vscode-extensions.java',
              },
            };
          } else {
            return extensionManagerServer.getExtensionFromMarketPlace(id);
          }
        },
      });

      createFakeExtension({
        extensionId: 'cloud-ide.java',
        packageJSON: {
          publisher: 'vscode',
          name: 'java',
        },
      });
      const { extensionId } = createFakeExtension({
        installed: false,
        extensionId: 'cloud-ide.debug',
        packageJSON: {
          extensionDependencies: ['vscode.java'],
        },
      });
      const debugExtension = extensionManagerService.getRawExtensionById(extensionId)!;
      await extensionManagerService.installExtension(debugExtension);
      // 因为依赖的插件(cloud-ide.java)已经下载，所以最后下载只会触发一次
      expect(fakeInstallExtension).toBeCalledTimes(1);
    });
  });

});
