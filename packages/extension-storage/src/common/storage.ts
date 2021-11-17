
import { KeysToAnyValues, KeysToKeysToAnyValue } from './types';
import { FileStat } from '@ide-framework/ide-file-service';
import { Uri } from '@ide-framework/ide-core-common';

export const IExtensionStorageServer = Symbol('ExtensionStorageServer');

export interface IExtensionStorageServer {
  set(key: string, value: KeysToAnyValues, isGlobal: boolean): Promise<void>;
  get(key: string, isGlobal: boolean): Promise<KeysToAnyValues>;
  getAll(isGlobal: boolean): Promise<KeysToKeysToAnyValue>;
  init(workspace: FileStat | undefined, roots: FileStat[], extensionStorageDirName?: string): Promise<ExtensionStorageUri>;
}

export const IExtensionStorageService = Symbol('ExtensionStorageService');

export interface IExtensionStorageService {
  whenReady: Promise<ExtensionStorageUri>;
  extensionStoragePath: ExtensionStorageUri;
  set(key: string, value: KeysToAnyValues, isGlobal: boolean): Promise<void>;
  get(key: string, isGlobal: boolean): Promise<KeysToAnyValues>;
  getAll(isGlobal: boolean): Promise<KeysToKeysToAnyValue>;
  reConnectInit(): void;
}

export interface ExtensionStorageUri {
  logUri: Uri;
  storageUri?: Uri;
  globalStorageUri: Uri;
}

export interface IExtensionStorageTask {
  [key: string]: {
    key: string;
    value: KeysToAnyValues;
  }[];
}
