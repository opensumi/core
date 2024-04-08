import { IRPCProtocol } from '@opensumi/ide-connection/lib/common/rpc/multiplexer';

import { createBrowserInjector } from '../../../../../../tools/dev-tool/src/injector-helper';
import { MainThreadAPIIdentifier } from '../../../../src/common/vscode';
import { ExtHostSecret } from '../../../../src/hosted/api/vscode/ext.host.secrets';
import { mockMultiplexerFactory } from '../../../../__mocks__/initRPCProtocol';

const moackMainThreadSecret = {
  $getPassword: jest.fn(),
  $setPassword: jest.fn(),
  $deletePassword: jest.fn(),
};

const rpcProtocol = mockMultiplexerFactory();

describe('extension/__tests__/hosted/api/vscode/ext.host.secret.test.ts', () => {
  let extHostSecret: ExtHostSecret;

  const injector = createBrowserInjector([]);
  const extensionId = 'extensionId';
  const key = 'key';

  beforeAll(() => {
    rpcProtocol.set(MainThreadAPIIdentifier.MainThreadSecret, moackMainThreadSecret as any);

    extHostSecret = injector.get(ExtHostSecret, [rpcProtocol]);
  });

  afterAll(async () => {
    await injector.disposeAll();
  });

  it('get', async () => {
    await extHostSecret.get(extensionId, key);
    expect(moackMainThreadSecret.$getPassword).toBeCalledTimes(1);
  });

  it('store', async () => {
    await extHostSecret.store(extensionId, key, 'test');
    expect(moackMainThreadSecret.$setPassword).toBeCalledTimes(1);
  });

  it('delete', async () => {
    await extHostSecret.delete(extensionId, key);
    expect(moackMainThreadSecret.$deletePassword).toBeCalledTimes(1);
  });

  it('onDidChangePassword', (done) => {
    const disposable = extHostSecret.onDidChangePassword(() => {
      disposable.dispose();
      done();
    });
    extHostSecret.$onDidChangePassword({ extensionId, key });
  });
});
