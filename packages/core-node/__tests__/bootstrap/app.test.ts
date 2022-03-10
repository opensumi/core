import http from 'http';
import net from 'net';
import path from 'path';

import Koa from 'koa';

import { normalizedIpcHandlerPath } from '@opensumi/ide-core-common/lib/utils/ipc';
import { ILogServiceManager, INodeLogger, ServerApp, ServerCommonModule } from '@opensumi/ide-core-node';

import { createNodeInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';

describe('ServerApp', () => {
  let injector: MockInjector;
  const mockNodeLogger = {
    log: jest.fn(),
  };

  beforeAll(() => {
    injector = createNodeInjector([]);
    injector.addProviders(
      {
        token: INodeLogger,
        useValue: mockNodeLogger,
      },
      {
        token: ILogServiceManager,
        useValue: {
          getLogger: () => console,
        },
      },
    );
  });

  afterAll(() => {
    injector.disposeAll();
  });

  test('start net server', async (done) => {
    const rpcListenPath = normalizedIpcHandlerPath('NODE-TEST', true);
    const app = new ServerApp({
      injector,
      modules: [ServerCommonModule],
      webSocketHandler: [],
      logDir: path.join(__dirname, 'logs'),
      processCloseExitThreshold: 0,
    });
    const server = net.createServer();
    await app.start(server);

    // server 的 connection 事件在测试环境下无法正常发送，只能跑一下执行
    server.listen(rpcListenPath, () => {
      server.close(() => {
        done();
      });
    });
  });

  test('start http server', async (done) => {
    const testPort = 9999;
    const koa = new Koa();
    const app = new ServerApp({
      injector,
      modules: [ServerCommonModule],
      use: koa.use.bind(koa),
      webSocketHandler: [],
      logDir: path.join(__dirname, 'logs'),
      processCloseExitThreshold: 0,
    });
    const server = http.createServer(koa.callback());
    await app.start(server);

    // server 的 connection 事件在测试环境下无法正常发送，只能跑一下执行
    server.listen(testPort, () => {
      server.close(() => {
        done();
      });
    });
  });
});
