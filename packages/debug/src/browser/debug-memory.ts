import { Injectable } from '@opensumi/di';
import {
  Event,
  FileSystemProvider,
  FileChangeEvent,
  FileStat,
  FileSystemProviderCapabilities,
  FileType,
  Uri,
  BinaryBuffer,
  Emitter,
  FileChange,
} from '@opensumi/ide-core-common';

@Injectable()
export class DebugMemoryFileSystemProvider implements FileSystemProvider {
  private readonly changeEmitter = new Emitter<FileChangeEvent>();

  public readonly capabilities: FileSystemProviderCapabilities =
    0 | FileSystemProviderCapabilities.PathCaseSensitive | FileSystemProviderCapabilities.FileOpenReadWriteClose;

  public readonly onDidChangeCapabilities = Event.None;

  onDidChangeFile: Event<FileChangeEvent> = this.changeEmitter.event;

  watch(uri: Uri, options: { recursive: boolean; excludes: string[] }): number | Promise<number> {
    throw new Error('Not allowed');
  }
  stat(uri: Uri): Promise<void | FileStat> {
    return Promise.resolve({
      type: FileType.File,
      uri: uri.toString(),
      mtime: 0,
      ctime: 0,
      size: 0,
      lastModification: 0,
      isDirectory: false,
    });
  }
  readDirectory(uri: Uri): [string, FileType][] | Promise<[string, FileType][]> {
    throw new Error('Not allowed');
  }
  createDirectory(uri: Uri): void | Promise<void | FileStat> {
    throw new Error('Not allowed');
  }
  readFile(uri: Uri, encoding?: string): void | Uint8Array | Promise<void | Uint8Array> {
    return BinaryBuffer.fromString('DebugMemoryFileSystemProvider').buffer;
  }
  writeFile(
    uri: Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean; encoding?: string | undefined },
  ): void | Thenable<void | FileStat> {
    throw new Error('Not allowed');
  }
  delete(uri: Uri, options: { recursive: boolean; moveToTrash?: boolean | undefined }): void | Promise<void> {
    throw new Error('Not allowed');
  }
  rename(oldstring: Uri, newstring: Uri, options: { overwrite: boolean }): void | Promise<void | FileStat> {
    throw new Error('Not allowed');
  }
}
