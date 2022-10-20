import * as Y from 'yjs';

import { INodeLogger } from '@opensumi/ide-core-node';
import { createNodeInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';
import { FileStat, IFileService } from '@opensumi/ide-file-service';
import { FileService } from '@opensumi/ide-file-service/src/node';

import { ICollaborationServiceForClient, IYWebsocketServer, ROOM_NAME } from '../../src';
import { CollaborationServiceForClient } from '../../src/node/collaboration.service';
import { YWebsocketServerImpl } from '../../src/node/y-websocket-server';

describe('Collaboration node ws server test', () => {
  let injector: MockInjector;
  let server: YWebsocketServerImpl;
  let service: CollaborationServiceForClient;
  let yDoc: Y.Doc;

  const MOCK_CONTENT = 'init mock content';

  beforeAll(() => {
    injector = createNodeInjector([]);
    injector.mockService(INodeLogger);
    injector.mockService(IFileService);
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

    const fileService: FileService = injector.get(IFileService);
    jest.spyOn(fileService, 'resolveContent').mockImplementation(async () => ({ content: MOCK_CONTENT } as any));

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

  it('should set init content correctly', async () => {
    await service.requestInitContent(TEST_URI);
    const yMap: Y.Map<Y.Text> = yDoc.getMap();
    expect(yMap.has(TEST_URI)).toBeTruthy();
    expect(yMap.get(TEST_URI)).toBeInstanceOf(Y.Text);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(yMap.get(TEST_URI)!.toString()).toBe(MOCK_CONTENT);
  });

  it('should remove Y.Text', () => {
    server.removeYText(TEST_URI);
    const yMap = yDoc.getMap();
    expect(yMap.has(TEST_URI)).toBeFalsy();
  });

  it('should correctly dispose', () => {
    const spy = jest.spyOn(server, 'destroy');
    server.destroy();
    expect(spy).toBeCalled();
  });

  afterAll(() => {
    yDoc.destroy();
  });
});
