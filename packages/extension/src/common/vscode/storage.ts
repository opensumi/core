import { ExtensionStorageUri } from '@opensumi/ide-extension-storage';
export interface KeysToAnyValues { [key: string]: any; }
export interface KeysToKeysToAnyValue { [key: string]: KeysToAnyValues; }

export interface IMainThreadStorage {
  $getValue(shared: boolean, key: string): Promise<KeysToAnyValues>;
  $setValue(shared: boolean, key: string, value: KeysToAnyValues): Promise<void>;
}

export interface IExtHostStorage {
  getValue<T>(shared: boolean, key: string, defaultValue?: T): Promise<T | KeysToAnyValues>;
  $acceptStoragePath(paths: ExtensionStorageUri): Promise<void>;
  $updateWorkspaceStorageData(data: KeysToKeysToAnyValue): Promise<void>;
}
