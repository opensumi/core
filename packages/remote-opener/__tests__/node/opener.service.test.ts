import { MockInjector, createNodeInjector, disposeAll } from '@opensumi/ide-dev-tool/src/mock-injector';
import {
  IRemoteOpenerClient,
  IRemoteOpenerService,
  RemoteOpenerClientToken,
  RemoteOpenerServiceToken,
} from '../../src/common';
import { RemoteOpenerClientImpl } from '../../src/node/opener.client';
import { RemoteOpenerServiceImpl } from '../../src/node/opener.service';

describe('packages/remote-opener/src/node/opener.service.ts', () => {
  let remoteOpenerService: IRemoteOpenerService;
  let remoteOpenerClient: IRemoteOpenerClient;

  let injector: MockInjector;

  beforeEach(() => {
    injector = createNodeInjector([]);
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

  afterEach(() => {
    return disposeAll(injector);
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
