import { FileSystemProvider } from '@opensumi/ide-core-browser';

export const IUserStorageService = Symbol('IUserStorageService');

export type IUserStorageService = FileSystemProvider;
