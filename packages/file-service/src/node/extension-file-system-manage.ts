import { Event, Uri, IDisposable } from '@ali/ide-core-common';
import {
  FileChangeEvent,
  FileStat,
  FileType,
  FileSystemProvider,
  IFileServiceExtClient,
} from '../common';

export class ExtensionFileSystemManage {
  readonly client: IFileServiceExtClient;

  constructor(client: IFileServiceExtClient) {
    this.client = client;
  }

  async get(scheme: string): Promise<FileSystemProvider | void> {
    const has = await this.client.runExtFileSystemClientMethod(
      'haveProvider',
      [scheme],
    );

    if (!has) {
      return;
    }

    return new ExtensionFileSystemProvider(
      this.client,
      scheme,
    );
  }
}

export class ExtensionFileSystemProvider implements FileSystemProvider {
  readonly onDidChangeFile: Event<FileChangeEvent>;
  readonly client: IFileServiceExtClient;
  readonly scheme: string;

  constructor(client: IFileServiceExtClient, scheme: string) {
    this.client = client;
    this.scheme = scheme;
  }

  watch(uri: Uri, options: { recursive: boolean; excludes: string[] }): IDisposable {
    let id;
    const idPromise = this.client.runExtFileSystemClientMethod(
      'watchFileWithProvider',
      [uri.toString(), options],
    ).then((getId) => id = getId);
    return {
      dispose: () => {
        if (!id) {
          return idPromise.then((id) => {
            this.client.runExtFileSystemClientMethod(
              'unWatchFileWithProvider',
              [id],
            );
          });
        }
        this.client.runExtFileSystemClientMethod(
          'unWatchFileWithProvider',
          [id],
        );
      },
    };
  }

  async stat(uri: Uri): Promise<FileStat> {
    return await this.client.runExtFileSystemProviderMethod(
      this.scheme,
      'stat',
      [uri.toString()],
    ) as any;
  }

  async readDirectory(uri: Uri): Promise<[string, FileType][]> {
    return await this.client.runExtFileSystemProviderMethod(
      this.scheme,
      'readDirectory',
      [uri.toString()],
    ) as any;
  }

  async createDirectory(uri: Uri): Promise<void> {
    return await this.client.runExtFileSystemProviderMethod(
      this.scheme,
      'createDirectory',
      [uri.toString()],
    ) as any;
  }

  async readFile(uri: Uri): Promise<Uint8Array> {
    return await this.client.runExtFileSystemProviderMethod(
      this.scheme,
      'readFile',
      [uri.toString()],
    ) as any;
  }

  async writeFile(
    uri: Uri,
    content: Uint8Array,
    options: { create: boolean, overwrite: boolean },
  ): Promise<void> {
    return await this.client.runExtFileSystemProviderMethod(
      this.scheme,
      'writeFile',
      [uri.toString(), content, options],
    ) as any;
  }

  async delete(
    uri: Uri,
    options: { recursive: boolean },
  ): Promise<void> {
    return await this.client.runExtFileSystemProviderMethod(
      this.scheme,
      'delete',
      [uri.toString(), options],
    ) as any;
  }

  async rename(
    oldUri: Uri,
    newUri: Uri,
    options: { overwrite: boolean },
  ): Promise<void> {
    return await this.client.runExtFileSystemProviderMethod(
      this.scheme,
      'rename',
      [oldUri.toString(), newUri.toString(), options],
    ) as any;
  }

  async copy(
    source: Uri,
    destination: Uri,
    options: { overwrite: boolean },
  ): Promise<void> {
    return await this.client.runExtFileSystemProviderMethod(
      this.scheme,
      'copy',
      [source.toString(), destination.toString(), options],
    ) as any;
  }
}
