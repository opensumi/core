
import { KeysToAnyValues, KeysToKeysToAnyValue } from './types';
import { FileStat } from '@ali/ide-file-service';

export const ExtensionStorageServerPath = 'ExtensionStorage';

export const IExtensionStorageServer = Symbol('ExtensionStorageServer');

export interface IExtensionStorageServer {
  set(key: string, value: KeysToAnyValues, isGlobal: boolean): Promise<boolean>;
  get(key: string, isGlobal: boolean): Promise<KeysToAnyValues>;
  getAll(isGlobal: boolean): Promise<KeysToKeysToAnyValue>;
  init(workspace: FileStat | undefined, roots: FileStat[]): Promise<ExtensionStoragePath>;
}

export const IExtensionStorageService = Symbol('ExtensionStorageService');

export interface IExtensionStorageService {
  whenReady: Promise<ExtensionStoragePath>;
  extensionStoragePath: ExtensionStoragePath;
  set(key: string, value: KeysToAnyValues, isGlobal: boolean): Promise<boolean>;
  get(key: string, isGlobal: boolean): Promise<KeysToAnyValues>;
  getAll(isGlobal: boolean): Promise<KeysToKeysToAnyValue>;
  reConnectInit(): void;
}

export interface ExtensionStoragePath {
  logPath: string;
  storagePath?: string;
  globalStoragePath: string;
}
