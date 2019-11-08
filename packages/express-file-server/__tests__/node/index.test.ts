import { createNodeInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { ExpressFileServerModule } from '../../src/node';
import { ExpressFileServerContribution } from '../../src/node/express-file-server.contribution';
import { IServerApp, AppConfig } from '@ali/ide-core-node';
import * as Koa from 'koa';
import * as superagent from 'superagent';
import * as http from 'http';
import * as path from 'path';

describe('template test', () => {
  let server: http.Server;
  const resPath = path.join(__dirname, '../res');
  beforeAll(() => {
    const injector = createNodeInjector([
      ExpressFileServerModule,
    ]);

    injector.addProviders({
      token: AppConfig,
      useValue: {
        marketplace: {},
        staticAllowPath: [
          resPath,
        ],
      },
    });

    const app = new Koa();
    const expressFileServerContribution = injector.get<ExpressFileServerContribution>(ExpressFileServerContribution);
    const mockServerApp: IServerApp = {
      use: app.use.bind(app),
      async start() {
        // 空实现
      },
    };

    expressFileServerContribution.initialize(mockServerApp);
    server = app.listen(8000);
  });

  it('can get png if path in whitelist', async (done) => {
    const res = await superagent
        .get(`http://127.0.0.1:8000/assets?path=${path.join(resPath, 'icon.png')}`);
    expect(res.status === 200);
    done();
  });

  it('response 403 if not in whitelist', async (done) => {
    try {
      await superagent
      .get('http://127.0.0.1:8000/assets?path=/test');
    } catch (err) {
      expect(err.status === 403);
    }

    done();
  });

  it('response 403 if not allowed mime', async (done) => {
    try {
      await superagent
      .get(`http://127.0.0.1:8000/assets?path=${path.join(resPath, 'icon.exe')}`);
    } catch (err) {
      expect(err.status === 403);
    }

    done();
  });

  afterAll(() => {
    server.close();
  });
});
