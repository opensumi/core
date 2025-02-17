import { WSChannelHandler } from '@opensumi/ide-connection/lib/browser';
import { ReconnectingWebSocketConnection } from '@opensumi/ide-connection/lib/common/connection/drivers/reconnecting-websocket';
import { BrowserConnectionErrorEvent, IEventBus, sleep } from '@opensumi/ide-core-common';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';
import { Server, WebSocket } from '@opensumi/mock-socket';

import { ClientAppStateService } from '../../src/application';
import { createConnectionService } from '../../src/bootstrap/connection';
(global as any).WebSocket = WebSocket;

describe('packages/core-browser/src/bootstrap/connection.test.ts', () => {
  let injector: MockInjector;
  let eventBus: IEventBus;
  let stateService: ClientAppStateService;
  beforeEach(() => {
    injector = createBrowserInjector([]);

    eventBus = injector.get(IEventBus);
  });

  afterEach(async () => {
    await injector.disposeAll();
  });

  it('handle WebSocket BrowserConnectionErrorEvent event', (done) => {
    const fakeWSURL = 'ws://localhost:8089';
    const mockServer = new Server(fakeWSURL);
    eventBus.on(BrowserConnectionErrorEvent, () => {
      mockServer.close();
      done();
    });
    stateService = injector.get(ClientAppStateService);
    const channelHandler = new WSChannelHandler(ReconnectingWebSocketConnection.forURL(fakeWSURL), 'test-client-id');
    createConnectionService(injector, [], channelHandler);
    stateService.state = 'core_module_initialized';

    sleep(4000).then(() => {
      mockServer.simulate('error');
    });
  });
});
