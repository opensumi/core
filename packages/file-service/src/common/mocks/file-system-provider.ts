import { Injectable } from '@ali/common-di';
import { IDiskFileProvider, FileType } from '../';
import { Emitter, Event } from '@ali/ide-core-common';
import { FileChangeEvent } from '../file-service-watcher-protocol';

@Injectable()
export class MockFsProvider implements IDiskFileProvider {
  _onDidChangeFile = new Emitter<FileChangeEvent>();
  onDidChangeFile: Event<FileChangeEvent> = this._onDidChangeFile.event;
  mockContent = new Map();
  watch(uri, options) {
    return 0;
  }
  unwatch(watcherId: number) {

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
    return [['sss', FileType.File], ['aaa', FileType.Directory]];
  }
  createDirectory(uri) {

  }
  readFile(uri) {
    return 'mock content';
  }
  writeFile(uri, content: string, options: { create: boolean; overwrite: boolean; }) {
    this.mockContent.set(uri.toString(), content);
  }
  delete(uri, options: { recursive: boolean; moveToTrash?: boolean | undefined; }) {

  }
  rename(oldUri, newUri, options: { overwrite: boolean; }) {

  }
  copy(s, d, opt) {

  }
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
