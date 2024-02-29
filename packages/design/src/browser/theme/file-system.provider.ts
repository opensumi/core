import { Injectable } from '@opensumi/di';
import {
  BinaryBuffer,
  Event,
  FileChangeEvent,
  FileStat,
  FileSystemProvider,
  FileSystemProviderCapabilities,
  FileType,
  Uri,
} from '@opensumi/ide-core-common';

import defaultTheme from './default-theme';
import lightTheme from './light-theme';

@Injectable()
export class DesignThemeFileSystemProvider implements FileSystemProvider {
  public readonly capabilities: FileSystemProviderCapabilities = FileSystemProviderCapabilities.Readonly;

  public readonly onDidChangeCapabilities = Event.None;
  public onDidChangeFile: Event<FileChangeEvent> = Event.None;

  public stat(uri: Uri): Promise<void | FileStat> {
    return Promise.resolve({
      type: FileType.File,
      uri: uri.toString(),
      lastModification: Date.now(),
      isDirectory: false,
    });
  }

  public async readFile(uri: Uri): Promise<Uint8Array> {
    const { query } = uri;

    if (defaultTheme.id === query) {
      return this.toBuffer(JSON.stringify(defaultTheme));
    }

    return this.toBuffer(JSON.stringify(lightTheme));
  }

  private toBuffer(s: string): Uint8Array {
    return BinaryBuffer.fromString(s).buffer;
  }

  public readDirectory(): never {
    throw new Error('Not allowed');
  }

  public createDirectory(): never {
    throw new Error('Not allowed');
  }

  public rename(): never {
    throw new Error('Not allowed');
  }

  public delete(): never {
    throw new Error('Not allowed');
  }

  public watch(): never {
    throw new Error('Not allowed');
  }

  public writeFile(): never {
    throw new Error('Not allowed');
  }
}
