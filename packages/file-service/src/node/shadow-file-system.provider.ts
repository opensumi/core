import Uri from 'vscode-uri';
import {
  Event,
  Emitter,
  IDisposable,
} from '@ali/ide-core-common';
import {
    FileChangeEvent,
    FileStat,
    FileType,
    DidFilesChangedParams,
    FileSystemError,
    FileMoveOptions,
    FileAccess,
    FileSystemProvider,
  } from '../common/';

export class ShadowFileSystemProvider implements FileSystemProvider {
    shadowFiles: Map<string, Uint8Array> = new Map<string, Uint8Array>();
    private fileChangeEmitter = new Emitter<FileChangeEvent>();
    onDidChangeFile: Event<FileChangeEvent> = this.fileChangeEmitter.event;
    watch(uri: Uri, options: { recursive: boolean; excludes: string[]; }): IDisposable {
        throw new Error('Method not implemented.');
    }
    stat(uri: Uri): FileStat | Thenable<FileStat> {
      return Promise.resolve({
        uri: uri.toString(),
        lastModification: 0,
      } as FileStat);
    }
    readDirectory(uri: Uri): [string, FileType][] | Thenable<[string, FileType][]> {
        throw new Error('Method not implemented.');
    }
    createDirectory(uri: Uri) {
        throw new Error('Method not implemented.');
    }
    readFile(uri: Uri) {
        const content = this.shadowFiles.get(uri.toString());
        return content ? new Buffer(content) : Buffer.from('no available');
    }
    writeFile(uri: Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }) {
        this.shadowFiles.set(uri.toString(), content);
    }
    delete(uri: Uri, options: { recursive: boolean; moveToTrash?: boolean; }) {
        throw new Error('Method not implemented.');
    }
    rename(oldUri: Uri, newUri: Uri, options: { overwrite: boolean; }) {
        throw new Error('Method not implemented.');
    }
    copy?(source: Uri, destination: Uri, options: { overwrite: boolean; }) {
        throw new Error('Method not implemented.');
    }
    exists?(uri: string | Uri): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    access?(uri: string, mode: number): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
}
