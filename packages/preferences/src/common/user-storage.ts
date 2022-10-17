import { FileSystemProvider } from '@opensumi/ide-core-common';

export const IUserStorageService = Symbol('IUserStorageService');

// tslint:disable-next-line: no-empty-interface
export type IUserStorageService = FileSystemProvider;
