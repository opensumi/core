import * as Y from 'yjs';

import { INodeLogger } from '@opensumi/ide-core-node';
import { createNodeInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';

import { ICollaborationServiceForClient, IYWebsocketServer, ROOM_NAME } from '../../lib';
import { CollaborationServiceForClient } from '../../lib/node/collaboration.service';
import { YWebsocketServerImpl } from '../../lib/node/y-websocket-server';

describe('Collaboration node ws server test', () => {
  let injector: MockInjector;
  let server: YWebsocketServerImpl;
  let service: CollaborationServiceForClient;
  let yDoc: Y.Doc;

  beforeAll(() => {
    injector = createNodeInjector([]);
    injector.mockService(INodeLogger);
    injector.addProviders(
      {
        token: IYWebsocketServer,
        useClass: YWebsocketServerImpl,
      },
      {
        token: ICollaborationServiceForClient,
        useClass: CollaborationServiceForClient,
      },
    );

    server = injector.get(IYWebsocketServer);
    service = injector.get(ICollaborationServiceForClient);
  });

  it('should correctly initialize', () => {
    const spy = jest.spyOn(server, 'initialize');
    server.initialize();
    expect(spy).toBeCalled();
  });

  it('should get Y.Doc', () => {
    yDoc = server.getYDoc(ROOM_NAME);
    expect(yDoc).toBeInstanceOf(Y.Doc);
  });

  const TEST_URI = 'file://foo';

  it('should set init content correctly', () => {
    service.setInitContent(TEST_URI, 'Hello');
    const yMap = yDoc.getMap();
    expect(yMap.has(TEST_URI)).toBeTruthy();
  });

  it('should remove Y.Text', () => {
    service.removeYText(TEST_URI);
    const yMap = yDoc.getMap();
    expect(yMap.has(TEST_URI)).toBeFalsy();
  });

  it('should correctly dispose', () => {
    const spy = jest.spyOn(server, 'dispose');
    server.dispose();
    expect(spy).toBeCalled();
  });

  afterAll(() => {
    yDoc.destroy();
  });
});
