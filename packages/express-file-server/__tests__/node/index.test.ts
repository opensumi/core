import http from 'http';
import path from 'path';

import Koa from 'koa';
import superagent from 'superagent';

import { IServerApp, AppConfig } from '@opensumi/ide-core-node';
import { createNodeInjector } from '@opensumi/ide-dev-tool/src/injector-helper';

import { ExpressFileServerModule } from '../../src/node';
import { ExpressFileServerContribution } from '../../src/node/express-file-server.contribution';


describe('template test', () => {
  let server: http.Server;
  const resPath = path.join(__dirname, '../res');
  beforeAll(() => {
    const injector = createNodeInjector([ExpressFileServerModule]);

    injector.addProviders({
      token: AppConfig,
      useValue: {
        marketplace: {},
        staticAllowPath: [resPath],
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
    server = app.listen(50118);
  });

  it('can get png if path in whitelist', async (done) => {
    const res = await superagent.get(`http://0.0.0.0:50118/assets${path.join(resPath, 'icon.png')}`);
    expect(res.status === 200);
    done();
  });

  it('response 403 if not in whitelist', async (done) => {
    try {
      await superagent.get('http://0.0.0.0:50118/assets/test');
    } catch (err) {
      expect(err.status === 403);
    }

    done();
  });

  it('response 403 if not allowed mime', async (done) => {
    try {
      await superagent.get(`http://0.0.0.0:50118/assets${path.join(resPath, 'icon.exe')}`);
    } catch (err) {
      expect(err.status === 403);
    }

    done();
  });

  afterAll(() => {
    server.close();
  });
});
