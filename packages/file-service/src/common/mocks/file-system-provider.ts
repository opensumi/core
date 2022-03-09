import { Injectable } from '@opensumi/di';
import { Emitter, Event } from '@opensumi/ide-core-common';
import { BinaryBuffer } from '@opensumi/ide-core-common/lib/utils/buffer';

import { FileChangeEvent } from '..';
import { IDiskFileProvider, FileType } from '../';

@Injectable()
export class MockFsProvider implements IDiskFileProvider {
  _onDidChangeFile = new Emitter<FileChangeEvent>();
  onDidChangeFile: Event<FileChangeEvent> = this._onDidChangeFile.event;
  mockContent = new Map();
  watch(uri, options) {
    return 0;
  }
  unwatch(watcherId: number) {}
  setWatchFileExcludes(excludes: string[]) {}
  getWatchFileExcludes(): string[] {
    return [];
  }
  async stat(uri) {
    return {
      uri: uri.toString(),
      lastModification: 1231231312,
      createTime: 232323332,
      isSymbolicLink: false,
      isDirectory: false,
      size: 23,
    };
  }
  // @ts-ignore
  readDirectory(uri) {
    return [
      ['sss', FileType.File],
      ['aaa', FileType.Directory],
    ];
  }
  createDirectory(uri) {}
  readFile(uri) {
    return BinaryBuffer.fromString('mock content').buffer;
  }
  writeFile(uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }) {
    this.mockContent.set(uri.toString(), content);
  }
  delete(uri, options: { recursive: boolean; moveToTrash?: boolean | undefined }) {}
  rename(oldUri, newUri, options: { overwrite: boolean }) {}
  copy(s, d, opt) {}
  async access() {
    return true;
  }
  async getCurrentUserHome() {
    return undefined;
  }
  async getFileType() {
    return undefined;
  }
}
