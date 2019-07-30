import Uri from 'vscode-uri';
import { IDisposable } from '@ali/ide-core-common';
import { FileSystemProvider, FileStat } from '../common/';

export class FileSystemManage {
  private readonly providers = new Map<string, FileSystemProvider>();

  add(schema: string, provider: FileSystemProvider): IDisposable {
    if (this.providers.has(schema)) {
      throw new Error(`A provider for the scheme ${schema} is already registered.`);
    }
    this.providers.set(schema, provider);
    return {
      dispose: () => {
        this.providers.delete(schema);
      },
    };
  }

  delete(schema: string) {
    this.providers.delete(schema);
  }

  get(schema: string) {
    return this.providers.get(schema);
  }
}

export class InsertedFileSystemProvider {
  private id: number;
  private proxy;

  constructor(id, proxy) {
    this.id = id;
    this.proxy = proxy;
  }

  stat(uri: Uri): FileStat | Thenable<FileStat> {
    return Promise.resolve({
      uri: 'kt:test',
      lastModification: 1,
      isDirectory: false,
    });
  }

}
