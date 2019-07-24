
import { KeysToAnyValues, KeysToKeysToAnyValue } from './types';

export const ExtensionStorageServerPath = '/services/extension-storage';

export const IExtensionStorageServer = Symbol('ExtensionStorageServer');

export interface IExtensionStorageServer {
  set(key: string, value: KeysToAnyValues, isGlobal: boolean): Promise<boolean>;
  get(key: string, isGlobal: boolean): Promise<KeysToAnyValues>;
  getAll(isGlobal: boolean): Promise<KeysToKeysToAnyValue>;
}

export const IExtensionStorageService = Symbol('ExtensionStorageService');

export interface IExtensionStorageService {
  set(key: string, value: KeysToAnyValues, isGlobal: boolean): Promise<boolean>;
  get(key: string, isGlobal: boolean): Promise<KeysToAnyValues>;
  getAll(isGlobal: boolean): Promise<KeysToKeysToAnyValue>;
}
