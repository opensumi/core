import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier, IMainThreadStorage, KeysToAnyValues, IExtHostStorage } from '../../common';
import { Injectable, Autowired, Optinal } from '@ali/common-di';
import { IExtensionStorageService } from '@ali/ide-extension-storage';
import { IDisposable } from '@ali/ide-core-browser';

@Injectable()
export class MainThreadStorage implements IMainThreadStorage {
  private readonly proxy: IExtHostStorage;
  private readonly _sharedStorageKeysToWatch: Map<string, boolean> = new Map<string, boolean>();
  private readonly _storageListener: IDisposable;

  @Autowired(IExtensionStorageService)
  extensionStorageService: IExtensionStorageService;

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostStorage);
    // this._storageListener = this.extensionStorageService.onDidChangeStorage
  }

  $setValue(shared: boolean, key: string, value: KeysToAnyValues) {
    try {
      this.extensionStorageService.set(key, value, shared);
    } catch (err) {
      return Promise.reject(err);
    }
    return Promise.resolve(undefined);
  }

  $getValue(shared: boolean, key: string) {
    if (shared) {
      this._sharedStorageKeysToWatch.set(key, true);
    }
    try {
      return Promise.resolve(this.extensionStorageService.get(key, shared));
    } catch (error) {
      return Promise.reject(error);
    }
  }

}
