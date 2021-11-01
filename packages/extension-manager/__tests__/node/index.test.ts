import { uuid } from '@ali/ide-core-common';
import { IExtensionManagerServer, BaseExtension, IExtensionManagerRequester, IExtensionManager } from '../../src/common';
import { ExtensionManagerModule } from '../../src/node';
import { createNodeInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { AppConfig, INodeLogger } from '@ali/ide-core-node';
import os from 'os';
import path from 'path';
import * as fs from 'fs-extra';
import { MockInjector } from '@ali/ide-dev-tool/src/mock-injector';

describe('template test', () => {

  let service: IExtensionManagerServer;
  let injector: MockInjector;
  const extensionDir = path.join(os.tmpdir(), '.extensions');

  beforeEach(async (done) => {
    injector = new MockInjector();
    injector.addProviders({
      token: AppConfig,
      useValue: {
        marketplace: {
          extensionDir,
          ignoreId: [],
        },
      },
    }, {
      token: INodeLogger,
      useValue: {
        // tslint:disable-next-line:no-console
        log: console.log,
        // tslint:disable-next-line:no-console
        error: console.error,
      },
    });

    const moduleInjector = createNodeInjector([ExtensionManagerModule], injector);

    service = moduleInjector.get(IExtensionManagerServer);
    done();
  });

  afterEach(() => {
    injector.disposeAll();
  });

  describe('endpoint path', () => {

    beforeEach(() => {
      injector.overrideProviders({
        token: AppConfig,
        useValue: {
          marketplace: {
            endpoint: 'https://marketplace.antfin-inc.com/proxy',
            extensionDir,
            ignoreId: [],
          },
        },
      });
    });

    it('endpoint support add path', () => {
      const requester = injector.get(IExtensionManagerRequester);

      const api = requester.getApi('abc');

      expect(api).toBe('https://marketplace.antfin-inc.com/proxy/openapi/ide/abc');

      const apiWithPath = requester.getApi('/abc');

      expect(apiWithPath).toBe('https://marketplace.antfin-inc.com/proxy/openapi/ide/abc');
    });
  });

  describe('search extension', () => {
    it('search for extension called es', async (done) => {
      injector.mock(IExtensionManagerRequester, 'request', () => {
        return {
          status: 200,
          data: {
            data: [{}, {}],
          },
        };
      });
      const res = await service.search('es');
      expect(res.data.length).toBeGreaterThan(1);
      done();
    });

    it('search non-existent extension', async (done) => {
      injector.mock(IExtensionManagerRequester, 'request', async () => {
        return {
          status: 200,
          data: {
            data: [],
          },
        };
      });
      const res = await service.search(uuid());
      expect(res.data.length).toBe(0);
      done();
    });
  });

  describe('get extension details', () => {
    it('get details for non-existent extension ', () => {
      injector.mock(IExtensionManagerRequester, 'request', () => {
        throw new Error('请求错误');
      });
      expect(service.getExtensionFromMarketPlace(uuid(), '0.0.1'))
        .rejects.toEqual(new Error('请求错误'));
    }, 10000);
  });

  describe('get extension deps', () => {
    it('get extension dependencies', async () => {
      injector.mock(IExtensionManagerRequester, 'request', () => {
        return {
          status: 200,
          data: {
            dependencies: ['aa.bb'],
          },
        };
      });
      const res = await service.getExtensionDeps('mock', '1.0.0');
      expect(res).toEqual({ dependencies: ['aa.bb'] });
    }, 20000);
  });

  describe('download extension', () => {
    it('download a extension', async (done) => {

      const { extensionId, name, publisher, path: extensionPath } = await createExtension();
      const { extensionId: extensionId2, path: extensionPath2 } = await createExtension();

      injector.mock(IExtensionManagerRequester, 'request', () => {
        return {
          status: 200,
          data: {
            dependencies: [extensionId2],
          },
        };
      });

      await service.installExtension({
        extensionId,
        name,
        path: '',
        version: '',
        publisher,
      });
      // 文件成功下载

      expect(await fs.pathExists(path.join(extensionPath, 'package.json')));

      // 会下载俩插件
      expect(await fs.pathExists(path.join(extensionPath2, 'package.json')));
      done();
    }, 30000);
  });

  describe('uninstall extension', () => {
    it('uninstall a extension', async (done) => {
      // 先下载一个插件
      const extension = await createExtension();
      const { path: extensionPath } = extension;
      await service.installExtension(extension);
      const packageFile = path.join(extensionPath, 'package.json');
      // 文件应该存在
      expect(await fs.pathExists(packageFile));
      const res = await service.uninstallExtension(extension);
      // 删除成功
      expect(res);
      // 文件被删除
      expect(!await fs.pathExists(packageFile));
      done();
    });

    it('uninstall non-existent extension', async (done) => {
      // 填写不存在的插件 id
      const res = await service.uninstallExtension({
        extensionId: uuid(),
        version: '',
        path: '',
        name: '',
        publisher: '',
      });
      // 结果返回 false
      expect(!res);
      done();
    });
  });

  describe('update extension', () => {
    it('update a extension', async (done) => {
      const version1 = '1.0.0';
      const version2 = '1.0.1';
      // 先下载一个插件
      const extensionId = uuid();
      const extension1 = await createExtension(extensionId, version1);
      await service.installExtension(extension1);
      // 再更新插件
      const extension2 = await createExtension(extensionId, version2);
      await service.updateExtension(extension1, version2);
      // 新插件已经下载
      expect(await fs.pathExists(path.join(extension2.path, 'package.json')));
      // 找不到之前的插件了
      expect(!await fs.pathExists(path.join(extension1.path, 'package.json')));
      done();
    });
  });

  describe('get extension other version', () => {
    it('get extension other version', async (done) => {
      injector.mock(IExtensionManagerRequester, 'request', () => {
        return {
          status: 200,
          data: {
            data: [{ version: '1.0.0' }, { version: '1.0.1' }],
          },
        };
      });
      const extension = await createExtension();
      const versionsInfo = await service.getExtensionVersions(extension.extensionId);

      // 新插件已经下载
      expect(versionsInfo.length === 2);
      // 找不到之前的插件了
      expect(versionsInfo[0].version === '1.0.0');
      done();
    });
  });

  describe('Extension Pack', () => {
    const createPackExtension = async (publisher = uuid(), name = uuid(), version = '0.0.1', pack: string[] = []) => {
      await fs.mkdirp(extensionDir);
      const extensionId = `${publisher}.${name}`;
      const extensionDirName = `${extensionId}-${version}`;
      const extensionPaths = [path.join(extensionDir, extensionDirName), ...pack.map((identifer) => path.join(extensionDir, `${identifer}-${version}`))];
      injector.mock(IExtensionManager, 'installer', {
        install: () => {
          return extensionPaths;
        },
      });
      return {
        extensionId,
        name,
        publisher,
        version,
        path: path.join(extensionDir, extensionDirName),
      };
    };

    it('Install pack extension, the sub extension which in the pack will be installed automatically', async () => {
      const packExtension = await createPackExtension('pack', 'extension', '0.0.1', ['sub.a', 'sub.b', 'sub.c', 'sub.d']);
      const paths = await service.installExtension(packExtension);

      // 安装 pack 扩展时，返回 string[]，包含 pack 中的 path
      expect(Array.isArray(paths) && paths.length === 5);

      // 返回包含自身的安装路径
      expect((paths as string[]).some((p) => new RegExp('pack.extension').test(p)));

      // 返回包含 sub.a 的安装路径
      expect((paths as string[]).some((p) => new RegExp('sub.a').test(p)));

      // pack 中的每一个 sub 扩展都被安装
      expect((paths as string[]).every((p) => fs.pathExistsSync(path.join(p, 'package.json'))));
    });

    it('Uninstall pack extension, the sub extension which in the pack will be uninstalled automatically', async () => {
      const packExtension = await createPackExtension('pack', 'extension', '0.0.1', ['sub.a', 'sub.b', 'sub.c', 'sub.d']);
      const paths = await service.installExtension(packExtension);

      // pack 中的每一个 sub 扩展都被安装
      expect((paths as string[]).every((p) => fs.pathExistsSync(path.join(p, 'package.json'))));

      // 卸载 pack
      await service.uninstallExtension(packExtension);

      // pack 中的每一个 sub 扩展都被卸载, 自己也被卸载
      expect((paths as string[]).every((p) => !fs.pathExistsSync(path.join(p, 'package.json'))));
    });
  });

  /**
   * 创建一个插件
   * @param extensionId 插件 id
   * @param version 插件版本
   * @return 插件名称
   */
  async function createExtension(publisher = uuid(), name = uuid(), version = '0.0.1'): Promise<BaseExtension> {
    await fs.mkdirp(extensionDir);
    const extensionId = `${publisher}.${name}`;
    const extensionDirName = `${extensionId}-${version}`;
    const extensionPath = path.join(extensionDir, extensionDirName);
    // mock 请求方法
    injector.mock(IExtensionManager, 'installer', {
      install: () => {
        return extensionPath;
      },
    });
    return {
      extensionId,
      name,
      publisher,
      version,
      path: extensionPath,
    };
  }

});
