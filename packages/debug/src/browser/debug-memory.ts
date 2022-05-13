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
} from '@opensumi/ide-core-common';

@Injectable()
export class DebugMemoryFileSystemProvider implements FileSystemProvider {
  capabilities: FileSystemProviderCapabilities;
  onDidChangeCapabilities: Event<void> = Event.None;
  readonly?: boolean | undefined;
  onDidChangeFile: Event<FileChangeEvent> = Event.None;
  watch(uri: Uri, options: { recursive: boolean; excludes: string[] }): number | Promise<number> {
    throw new Error('Method not implemented.');
  }
  stat(uri: Uri): Promise<void | FileStat> {
    throw new Error('Method not implemented.');
  }
  readDirectory(uri: Uri): [string, FileType][] | Promise<[string, FileType][]> {
    throw new Error('Method not implemented.');
  }
  createDirectory(uri: Uri): void | Promise<void | FileStat> {
    throw new Error('Method not implemented.');
  }
  readFile(uri: Uri, encoding?: string): void | Uint8Array | Promise<void | Uint8Array> {
    return BinaryBuffer.fromString('DebugMemoryFileSystemProvider').buffer;
  }
  writeFile(
    uri: Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean; encoding?: string | undefined },
  ): void | Thenable<void | FileStat> {
    throw new Error('Method not implemented.');
  }
  delete(uri: Uri, options: { recursive: boolean; moveToTrash?: boolean | undefined }): void | Promise<void> {
    throw new Error('Method not implemented.');
  }
  rename(oldstring: Uri, newstring: Uri, options: { overwrite: boolean }): void | Promise<void | FileStat> {
    throw new Error('Method not implemented.');
  }
}
