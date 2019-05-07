import { Injectable, Provider } from '@ali/common-di';
import { ConstructorOf } from '@ali/ide-core';

export interface CloudFile {
  name: string;
  path: string;
}

@Injectable()
export abstract class FileTreeAPI {
  abstract getFiles(...paths: string[]): Promise<CloudFile[]>;
  abstract createFile(file: CloudFile): Promise<CloudFile>;
  abstract deleteFile(file: CloudFile): Promise<void>;
}

export function createFileTreeAPIProvider<T extends FileTreeAPI>(cls: ConstructorOf<T>): Provider {
  return {
    token: FileTreeAPI as any,
    useClass: cls as any,
  };
}
