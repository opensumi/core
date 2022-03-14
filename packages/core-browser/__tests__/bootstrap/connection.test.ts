import { WebSocket, Server } from 'mock-socket';

import { IEventBus, EventBusImpl, BrowserConnectionErrorEvent } from '@opensumi/ide-core-common';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { createClientConnection2 } from '../../src/bootstrap/connection';
(global as any).WebSocket = WebSocket;

describe('packages/core-browser/src/bootstrap/connection.test.ts', () => {
  let injector: MockInjector;
  let eventBus: IEventBus;
  let isError = false;
  beforeEach(() => {
    injector = createBrowserInjector(
      [],
      new MockInjector([
        {
          token: IEventBus,
          useClass: EventBusImpl,
        },
      ]),
    );

    eventBus = injector.get(IEventBus);
  });

  it('handle WebSocket BrowserConnectionErrorEvent event', async (done) => {
    const fakeWSURL = 'ws://localhost:8089';
    const mockServer = new Server(fakeWSURL);
    eventBus.on(BrowserConnectionErrorEvent, () => {
      isError = true;
    });

    createClientConnection2(injector, [], fakeWSURL, () => {});
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 4000);
    });

    mockServer.simulate('error');

    expect(isError).toBe(true);

    mockServer.close();
    done();
  });
});
