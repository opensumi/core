import { WebSocket, Server } from 'mock-socket';

import { IEventBus, BrowserConnectionErrorEvent } from '@opensumi/ide-core-common';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { ClientAppStateService } from '../../src/application';
import { createClientConnection2 } from '../../src/bootstrap/connection';
(global as any).WebSocket = WebSocket;

describe('packages/core-browser/src/bootstrap/connection.test.ts', () => {
  let injector: MockInjector;
  let eventBus: IEventBus;
  let stateService: ClientAppStateService;
  beforeEach(() => {
    injector = createBrowserInjector([]);

    eventBus = injector.get(IEventBus);
  });

  afterEach(() => {
    injector.disposeAll();
  });

  it('handle WebSocket BrowserConnectionErrorEvent event', async (done) => {
    const fakeWSURL = 'ws://localhost:8089';
    const mockServer = new Server(fakeWSURL);
    eventBus.on(BrowserConnectionErrorEvent, () => {
      mockServer.close();
      done();
    });
    stateService = injector.get(ClientAppStateService);
    createClientConnection2(injector, [], fakeWSURL, () => {});
    stateService.state = 'core_module_initialized';
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 4000);
    });

    mockServer.simulate('error');
  });
});
