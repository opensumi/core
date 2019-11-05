import { uuid } from '@ali/ide-core-common';
import { IExtensionManagerServer, BaseExtension, IExtensionManagerRequester } from '../../src/common';
import { ExtensionManagerModule } from '../../src/node';
import { createNodeInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { AppConfig, INodeLogger } from '@ali/ide-core-node';
import * as os from 'os';
import * as path from 'path';
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
        },
      },
    }, {
      token: INodeLogger,
      useValue: {
        log: console.log,
        error: console.error,
      },
    });

    const moduleInjector = createNodeInjector([ExtensionManagerModule], injector);

    service = moduleInjector.get(IExtensionManagerServer);
    done();
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

  describe('download extension', () => {
    it('download a extension', async (done) => {
      const extensionId = uuid();
      const { path: extensionPath } = await createExtension(extensionId);
      await service.installExtension({
        extensionId,
        name: '',
        path: '',
        version: '',
      });
      // 文件成功下载
      expect(await fs.pathExists(path.join(extensionPath, 'package.json')));
      done();
    }, 30000);
  });

  describe('uninstall extension', () => {
    it('uninstall a extension', async (done) => {
      // 先下载一个插件
      const extensionId = uuid();
      const version = '1.0.0';
      const extension = await createExtension(extensionId, version);
      await service.installExtension(extension);
      const packageFile = path.join(extension.path, 'package.json');
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

  /**
   * 创建一个插件
   * @param extensionId 插件 id
   * @param version 插件版本
   * @return 插件名称
   */
  async function createExtension(extensionId = uuid(), version = '0.0.1'): Promise<BaseExtension> {
    await fs.mkdirp(extensionDir);
    const extensionName = uuid();
    const extensionDirName = `${extensionId}-${extensionName}-${version}`;
    // mock 请求方法
    injector.mock(IExtensionManagerRequester, 'request', () => ({
      headers: {
        'content-disposition': `attachment; filename="${extensionDirName}.zip"`,
      },
      res: fs.createReadStream(path.join(__dirname, `../res/5d7102ffe8ecb2045ca51ef5-1.9.1.zip`)),
    }));
    return {
      extensionId,
      name: extensionName,
      version,
      path: path.join(extensionDir, extensionDirName),
    };
  }

});
