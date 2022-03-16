import { Uri } from '@opensumi/ide-core-common';
import { FileStat } from '@opensumi/ide-file-service';

import { KeysToAnyValues, KeysToKeysToAnyValue } from './types';

export const IExtensionStorageServer = Symbol('ExtensionStorageServer');

export interface IExtensionStorageServer {
  set(key: string, value: KeysToAnyValues, isGlobal: boolean): Promise<void>;
  get(key: string, isGlobal: boolean): Promise<KeysToAnyValues>;
  getAll(isGlobal: boolean): Promise<KeysToKeysToAnyValue>;
  init(
    workspace: FileStat | undefined,
    roots: FileStat[],
    extensionStorageDirName?: string,
  ): Promise<ExtensionStorageUri>;
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
