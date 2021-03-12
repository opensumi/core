
import { KeysToAnyValues, KeysToKeysToAnyValue } from './types';
import { FileStat } from '@ali/ide-file-service';

export const IExtensionStorageServer = Symbol('ExtensionStorageServer');

export interface IExtensionStorageServer {
  set(key: string, value: KeysToAnyValues, isGlobal: boolean): Promise<void>;
  get(key: string, isGlobal: boolean): Promise<KeysToAnyValues>;
  getAll(isGlobal: boolean): Promise<KeysToKeysToAnyValue>;
  init(workspace: FileStat | undefined, roots: FileStat[], extensionStorageDirName?: string): Promise<ExtensionStoragePath>;
}

export const IExtensionStorageService = Symbol('ExtensionStorageService');

export interface IExtensionStorageService {
  whenReady: Promise<ExtensionStoragePath>;
  extensionStoragePath: ExtensionStoragePath;
  set(key: string, value: KeysToAnyValues, isGlobal: boolean): Promise<void>;
  get(key: string, isGlobal: boolean): Promise<KeysToAnyValues>;
  getAll(isGlobal: boolean): Promise<KeysToKeysToAnyValue>;
  reConnectInit(): void;
}

export interface ExtensionStoragePath {
  logPath: string;
  storagePath?: string;
  globalStoragePath: string;
}

export interface IExtensionStorageTask {
  [key: string]: {
    key: string;
    value: KeysToAnyValues;
  }[];
}
