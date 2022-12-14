/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@opensumi/di';
import { Emitter, Event, BinaryBuffer, Uri, FileSystemProviderCapabilities } from '@opensumi/ide-core-common';

import { FileChangeEvent, IDiskFileProvider, FileType } from '../src/common';

@Injectable()
export class MockFsProvider implements IDiskFileProvider {
  private _onDidChangeFile = new Emitter<FileChangeEvent>();
  private _onDidChangeCapabilities = new Emitter<void>();

  get capabilities() {
    return FileSystemProviderCapabilities.FileFolderCopy;
  }

  get onDidChangeCapabilities() {
    return this._onDidChangeCapabilities.event;
  }

  get onDidChangeFile() {
    return this._onDidChangeFile.event;
  }

  async watch(_uri, _options) {
    return 0;
  }

  async unwatch(_watcherId: number) {}

  async setWatchFileExcludes(_excludes: string[]) {}

  async getWatchFileExcludes() {
    return [];
  }

  async stat(uri) {
    return {
      uri: uri.toString(),
      lastModification: Date.now(),
      createTime: Date.now(),
      isSymbolicLink: false,
      isDirectory: false,
      size: 23,
    };
  }

  async readDirectory(_uri: Uri) {
    return [
      ['a', FileType.File],
      ['b', FileType.Directory],
    ] as any;
  }

  async createDirectory(_uri: Uri) {
    throw new Error('Method not implemented.');
  }

  async readFile(_uri: Uri) {
    return BinaryBuffer.fromString('').buffer;
  }

  async writeFile(_uri: Uri, content: Uint8Array, _options: { create: boolean; overwrite: boolean }) {
    throw new Error('Method not implemented.');
  }

  async delete(_uri, _options: { recursive: boolean; moveToTrash?: boolean | undefined }) {
    throw new Error('Method not implemented.');
  }

  async rename(_oldUri, _newUri, _options: { overwrite: boolean }) {
    throw new Error('Method not implemented.');
  }

  async copy(_s, _d, _opt) {
    throw new Error('Method not implemented.');
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
