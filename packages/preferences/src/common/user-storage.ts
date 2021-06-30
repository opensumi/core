
import { FileSystemProvider } from '@ali/ide-core-browser';

export const IUserStorageService = Symbol('IUserStorageService');

// tslint:disable-next-line: no-empty-interface
export interface IUserStorageService extends FileSystemProvider {}

export const USER_STORAGE_SCHEME = 'user_storage';
