import {
  IRemoteOpenerClient,
  IRemoteOpenerService,
  RemoteOpenerClientToken,
} from '@opensumi/ide-remote-opener/lib/common';
import { RemoteOpenerClientImpl } from '@opensumi/ide-remote-opener/lib/node/opener.client';

import { createNodeInjector } from '../../../../tools/dev-tool/src/injector-helper';

describe('packages/remote-opener/src/node/opener.client.ts', () => {
  let remoteOpenerClient: IRemoteOpenerClient;

  beforeEach(() => {
    const injector = createNodeInjector([]);
    injector.addProviders({
      token: RemoteOpenerClientToken,
      useClass: RemoteOpenerClientImpl,
    });
    remoteOpenerClient = injector.get(RemoteOpenerClientToken);
  });

  it('setRemoteOpenerServiceInstance should be work', () => {
    const service: IRemoteOpenerService = {
      openExternal: jest.fn(),
      removeConnectionClientId: jest.fn(),
      setConnectionClientId: jest.fn(),
    };
    remoteOpenerClient.setRemoteOpenerServiceInstance('mock_clientId', service);
    expect(remoteOpenerClient['remoteOpenerServices'].has('mock_clientId')).toBeTruthy();
    expect(remoteOpenerClient['remoteOpenerServices'].get('mock_clientId')).toBe(service);
    expect(() => remoteOpenerClient.setRemoteOpenerServiceInstance('mock_clientId', service)).toThrow(
      new Error('Remote opener service instance for client mock_clientId already set.'),
    );
  });

  it('removeRemoteOpenerServiceInstance should be work', () => {
    const service: IRemoteOpenerService = {
      openExternal: jest.fn(),
      removeConnectionClientId: jest.fn(),
      setConnectionClientId: jest.fn(),
    };
    remoteOpenerClient.setRemoteOpenerServiceInstance('mock_clientId_removeable', service);
    expect(remoteOpenerClient['remoteOpenerServices'].has('mock_clientId_removeable')).toBeTruthy();
    expect(remoteOpenerClient['remoteOpenerServices'].get('mock_clientId_removeable')).toBe(service);
    remoteOpenerClient.removeRemoteOpenerServiceInstance('mock_clientId_removeable');
    expect(remoteOpenerClient['remoteOpenerServices'].has('mock_clientId_removeable')).toBeFalsy();
  });

  it('openExternal should be work', async (done) => {
    const service: IRemoteOpenerService = {
      openExternal: jest.fn(),
      removeConnectionClientId: jest.fn(),
      setConnectionClientId: jest.fn(),
    };

    remoteOpenerClient.setRemoteOpenerServiceInstance('mock_clientId_2', service);

    await remoteOpenerClient.openExternal(
      {
        file: 'mock_file',
        type: 'file',
        clientId: 'mock_clientId_2',
      },
      'mock_clientId_2',
    );

    expect(service.openExternal).toBeCalledWith({
      file: 'mock_file',
      type: 'file',
      clientId: 'mock_clientId_2',
    });

    done();
  });

  it('openExternal fallback should be work', async (done) => {
    const service: IRemoteOpenerService = {
      openExternal: jest.fn(),
      removeConnectionClientId: jest.fn(),
      setConnectionClientId: jest.fn(),
    };

    remoteOpenerClient.setRemoteOpenerServiceInstance('mock_clientId_3', service);

    // 随便来个错误的clientId
    await remoteOpenerClient.openExternal(
      {
        file: 'mock_file',
        type: 'file',
        clientId: 'stub_clientId',
      },
      'stub_clientId',
    );

    expect(service.openExternal).toBeCalledWith({
      file: 'mock_file',
      type: 'file',
      clientId: 'mock_clientId_3', // 被fallback到了mock_clientId_3
    });

    done();
  });
});
