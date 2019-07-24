import { Injectable, Autowired } from '@ali/common-di';
import { ExtensionStorageServerPath, IExtensionStorageService, KeysToAnyValues, KeysToKeysToAnyValue, IExtensionStorageServer } from '../common' ;

@Injectable()
export class ExtensionStorageService implements IExtensionStorageService {
  @Autowired(ExtensionStorageServerPath)
  extensionStorageServer: IExtensionStorageServer;

  set(key: string, value: KeysToAnyValues, isGlobal: boolean) {
    return this.extensionStorageServer.set(key, value, isGlobal);
  }

  get(key: string, isGlobal: boolean): Promise<KeysToAnyValues> {
    return this.extensionStorageServer.get(key, isGlobal);
  }

  getAll(isGlobal: boolean = false): Promise<KeysToKeysToAnyValue> {
      return this.extensionStorageServer.getAll(isGlobal);
  }
}
