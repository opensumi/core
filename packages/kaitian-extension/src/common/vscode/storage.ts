import { ExtensionStorageUri } from '@ali/ide-extension-storage';
export interface KeysToAnyValues { [key: string]: any; }
export interface KeysToKeysToAnyValue { [key: string]: KeysToAnyValues; }

export interface IMainThreadStorage {
  $getValue(shared: boolean, key: string): Promise<KeysToAnyValues>;
  $setValue(shared: boolean, key: string, value: KeysToAnyValues): Promise<void>;
}

export interface IExtHostStorage {
  $acceptStoragePath(paths: ExtensionStorageUri): Promise<void>;
  $updateWorkspaceStorageData(data: KeysToKeysToAnyValue): Promise<void>;
}
