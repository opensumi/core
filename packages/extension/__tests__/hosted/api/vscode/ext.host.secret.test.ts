import { IRPCProtocol } from '@opensumi/ide-connection/lib/common/rpcProtocol';

import { createBrowserInjector } from '../../../../../../tools/dev-tool/src/injector-helper';
import { MainThreadAPIIdentifier } from '../../../../src/common/vscode';
import { ExtHostSecret } from '../../../../src/hosted/api/vscode/ext.host.secrets';

const moackMainThreadSecret = {
  $getPassword: jest.fn(),
  $setPassword: jest.fn(),
  $deletePassword: jest.fn(),
};

const map = new Map();

const rpcProtocol: IRPCProtocol = {
  getProxy: (key) => map.get(key),
  set: (key, value) => {
    map.set(key, value);
    return value;
  },
  get: (r) => map.get(r),
};

describe('extension/__tests__/hosted/api/vscode/ext.host.secret.test.ts', () => {
  let extHostSecret: ExtHostSecret;

  const injector = createBrowserInjector([]);
  const extensionId = 'extensionId';
  const key = 'key';

  beforeAll(() => {
    rpcProtocol.set(MainThreadAPIIdentifier.MainThreadSecret, moackMainThreadSecret as any);

    extHostSecret = injector.get(ExtHostSecret, [rpcProtocol]);
  });

  afterAll(() => {
    injector.disposeAll();
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
