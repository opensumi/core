import { IRPCProtocol } from '@opensumi/ide-connection/lib/common/rpcProtocol';
import { URI, StoragePaths } from '@opensumi/ide-core-common';

import { createBrowserInjector } from '../../../../../../tools/dev-tool/src/injector-helper';
import { MainThreadAPIIdentifier } from '../../../../src/common/vscode';
import {
  ExtensionGlobalMemento,
  ExtensionMemento,
  ExtHostStorage,
} from '../../../../src/hosted/api/vscode/ext.host.storage';


const cache = {
  shared: {},
  unShared: {},
};
const moackMainThreadStorage = {
  $getValue: jest.fn(async (shared: boolean, key: string) => (shared ? cache.shared[key] : cache.unShared[key])),
  $setValue: jest.fn(async (shared: boolean, key: string, value: any) => {
    if (shared) {
      cache.shared[key] = value;
    } else {
      cache.unShared[key];
    }
  }),
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

describe('extension/__tests__/hosted/api/vscode/ext.host.storage.test.ts', () => {
  let extHostStorage: ExtHostStorage;

  const injector = createBrowserInjector([]);
  const storagePath = URI.file('/userhome');
  const extensionId = 'opensumi.test-extension';

  beforeAll(() => {
    rpcProtocol.set(MainThreadAPIIdentifier.MainThreadStorage, moackMainThreadStorage as any);

    extHostStorage = injector.get(ExtHostStorage, [rpcProtocol]);
  });

  afterAll(() => {
    injector.disposeAll();
  });

  it('init storage path', async () => {
    extHostStorage.$acceptStoragePath({
      logUri: storagePath.resolve('logs').codeUri,
      storageUri: storagePath.resolve(StoragePaths.EXTENSIONS_WORKSPACE_STORAGE_DIR).codeUri,
      globalStorageUri: storagePath.resolve(StoragePaths.EXTENSIONS_GLOBAL_STORAGE_DIR).codeUri,
    });
    expect(extHostStorage.storagePath).toBeTruthy();
  });

  it('getValue', async () => {
    await extHostStorage.getValue(false, 'test');
    expect(moackMainThreadStorage.$getValue).toBeCalledTimes(1);
  });

  it('setValue', async () => {
    await extHostStorage.setValue(false, 'test', {});
    expect(moackMainThreadStorage.$setValue).toBeCalledTimes(1);
  });

  it('ExtensionMemento', async () => {
    const workspaceState = new ExtensionMemento(extensionId, false, extHostStorage);
    await workspaceState.whenReady;
    const key = 'key';
    const value = 'value';
    workspaceState.update(key, value);
    expect(workspaceState.get(key)).toBe(value);
    expect(workspaceState.keys).toEqual([key]);
  });

  it('ExtensionGlobalMemento', async () => {
    const globalState = new ExtensionGlobalMemento(extensionId, true, extHostStorage);
    expect(globalState.setKeysForSync).toBeDefined();
    await globalState.whenReady;
    const key = 'key';
    const value = 'value';
    globalState.update(key, value);
    expect(globalState.get(key)).toBe(value);
    expect(globalState.keys).toEqual([key]);
  });
});
