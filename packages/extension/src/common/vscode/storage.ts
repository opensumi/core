import { Event, Uri } from '@opensumi/ide-core-common';
import { IExtensionStorageUri } from '@opensumi/ide-extension-storage';

export interface KeysToAnyValues {
  [key: string]: any;
}
export interface KeysToKeysToAnyValue {
  [key: string]: KeysToAnyValues;
}

export interface IMainThreadStorage {
  $getValue(shared: boolean, key: string): Promise<KeysToAnyValues>;
  $setValue(shared: boolean, key: string, value: KeysToAnyValues): Promise<void>;
}

export interface IStorageChangeEvent {
  shared: boolean;
  data: KeysToAnyValues;
}

export interface IExtHostStorage {
  onDidChangeStorage: Event<IStorageChangeEvent>;

  getValue<T>(shared: boolean, key: string, defaultValue?: T): Promise<T | KeysToAnyValues>;
  setValue(shared: boolean, key: string, value: any): Promise<void>;

  getExtensionStorageUri(extensionId: string): Uri;
  getExtensionGlobalStorageUri(extensionId: string): Uri;
  getExtensionLogUri(extensionId: string): Uri;

  $acceptStoragePath(paths: IExtensionStorageUri): Promise<void>;
  $updateWorkspaceStorageData(data: KeysToKeysToAnyValue): Promise<void>;
}
