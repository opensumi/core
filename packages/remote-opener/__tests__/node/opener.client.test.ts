import { createNodeInjector } from '../../../../tools/dev-tool/src/injector-helper';
import {
  IRemoteOpenerClient,
  IRemoteOpenerService,
  RemoteOpenerClientToken,
} from '@opensumi/ide-remote-opener/lib/common';
import { RemoteOpenerClientImpl } from '@opensumi/ide-remote-opener/lib/node/opener.client';

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
    };
    remoteOpenerClient.setRemoteOpenerServiceInstance('mock_clientId', service);
    expect(remoteOpenerClient['remoteOpenerServices'].has('mock_clientId')).toBeTruthy();
    expect(remoteOpenerClient['remoteOpenerServices'].get('mock_clientId')).toBe(service);
    expect(() => remoteOpenerClient.setRemoteOpenerServiceInstance('mock_clientId', service)).toThrow(
      new Error('Remote opener service instance for client mock_clientId already set.'),
    );
  });

  it('openExternal should be work', async (done) => {
    const service: IRemoteOpenerService = {
      openExternal: jest.fn(),
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
});
