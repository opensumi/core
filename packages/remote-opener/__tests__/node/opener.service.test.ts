import {
  IRemoteOpenerClient,
  IRemoteOpenerService,
  RemoteOpenerClientToken,
  RemoteOpenerServiceToken,
} from '@opensumi/ide-remote-opener/lib/common';
import { RemoteOpenerClientImpl } from '@opensumi/ide-remote-opener/lib/node/opener.client';
import { RemoteOpenerServiceImpl } from '@opensumi/ide-remote-opener/lib/node/opener.service';

import { createNodeInjector } from '../../../../tools/dev-tool/src/injector-helper';

describe('packages/remote-opener/src/node/opener.service.ts', () => {
  let remoteOpenerService: IRemoteOpenerService;
  let remoteOpenerClient: IRemoteOpenerClient;

  beforeEach(() => {
    const injector = createNodeInjector([]);
    injector.addProviders(
      {
        token: RemoteOpenerServiceToken,
        useClass: RemoteOpenerServiceImpl,
      },
      {
        token: RemoteOpenerClientToken,
        useClass: RemoteOpenerClientImpl,
      },
    );

    remoteOpenerService = injector.get(RemoteOpenerServiceToken);
    remoteOpenerClient = injector.get(RemoteOpenerClientToken);
  });

  it('openExternal should be work', async () => {
    const spyOnSetInstance = jest.spyOn(remoteOpenerClient, 'setRemoteOpenerServiceInstance');
    remoteOpenerService['setConnectionClientId']('mock_client_id');
    expect(spyOnSetInstance).toBeCalledWith('mock_client_id', remoteOpenerService);

    const spyOnOpenExternal = jest.spyOn(remoteOpenerService, 'openExternal');
    expect(remoteOpenerService['clientId']).toBe('mock_client_id');

    await remoteOpenerService.openExternal({
      file: 'mock_file',
      type: 'file',
      clientId: 'mock_client_id',
    });
    expect(spyOnOpenExternal).toBeCalledWith({
      file: 'mock_file',
      type: 'file',
      clientId: 'mock_client_id',
    });
  });
});
