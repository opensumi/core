import { IRPCProtocol } from '@opensumi/ide-connection';
import { ExtHostAPIIdentifier, IMainThreadStorage, KeysToAnyValues, IExtHostStorage } from '../../../common/vscode';
import { Injectable, Autowired, Optinal } from '@opensumi/common-di';
import { IExtensionStorageService } from '@opensumi/ide-extension-storage';

@Injectable({multiple: true})
export class MainThreadStorage implements IMainThreadStorage {
  private readonly proxy: IExtHostStorage;

  @Autowired(IExtensionStorageService)
  extensionStorageService: IExtensionStorageService;

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostStorage);
    this.init();
  }

  public dispose() {}

  async init() {
    await this.extensionStorageService.whenReady;
    this.proxy.$acceptStoragePath(this.extensionStorageService.extensionStoragePath);
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
    try {
      return Promise.resolve(this.extensionStorageService.get(key, shared));
    } catch (error) {
      return Promise.reject(error);
    }
  }
}
