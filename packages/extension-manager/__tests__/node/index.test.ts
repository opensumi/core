import { uuid } from '@ali/ide-core-common';
import { IExtensionManagerServer } from '../../src/common';
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
  const extensionDir = path.join(os.tmpdir(), '.extension');
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
        error: console.error,
      },
    });

    const moduleInjector = createNodeInjector([ExtensionManagerModule], injector);

    service = moduleInjector.get(IExtensionManagerServer);
    done();
  });

  describe('search extension', () => {
    it('search for extension called es', async (done) => {
      injector.mock(IExtensionManagerServer, 'request', () => {
        return {
          data: [{}, {}],
        };
      });
      const res = await service.search('es');
      expect(res.data.length).toBeGreaterThan(1);
      done();
    });

    it('search non-existent extension', async (done) => {
      injector.mock(IExtensionManagerServer, 'request', () => {
        return {
          data: [],
        };
      });
      const res = await service.search(uuid());
      expect(res.data.length).toBe(0);
      done();
    });
  });

  describe('get extension details', () => {
    it('get details for non-existent extension ', () => {
      injector.mock(IExtensionManagerServer, 'request', () => {
        throw new Error('请求错误');
      });
      expect(service.getExtensionFromMarketPlace(uuid()))
        .rejects.toEqual(new Error('请求错误'));
    }, 10000);
  });

  describe('download extension', () => {
    it('download a extension', async (done) => {
      await fs.mkdirp(extensionDir);
      const extensionId = '5d7102ffe8ecb2045ca51ef5';
      const fileName = `${extensionId}-1.9.1`;
      // mock 请求方法
      injector.mock(IExtensionManagerServer, 'requestExtension', () => ({
        headers: {
          'content-disposition': `attachment; filename="${fileName}.zip"`,
        },
        res: fs.createReadStream(path.join(__dirname, `../res/${fileName}.zip`)),
      }));
      await service.downloadExtension(extensionId);
      // 文件成功下载
      expect(fs.existsSync(path.join(extensionDir, fileName, 'package.json')));
      done();
    }, 30000);
  });

});
