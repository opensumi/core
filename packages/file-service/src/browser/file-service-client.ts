
// import { Event } from '@ali/ide-core-common/lib/event';
import { Injectable, Inject } from '@ali/common-di';
import { servicePath as FileServicePath, IFileService, FileStat } from '../common/index';
import { TextDocumentContentChangeEvent } from 'vscode-languageserver-types';

@Injectable()
export class FileServiceClient {
  constructor(@Inject(FileServicePath) protected readonly fileService: IFileService) {
  }

  async resolveContent(uri: string, options?: { encoding?: string }) {
    return this.fileService.resolveContent(uri, options);
  }

  async getFileStat(uri: string) {
    return this.fileService.getFileStat(uri);
  }

  // async updateContent(file: FileStat, contentChanges: TextDocumentContentChangeEvent[], options?: { encoding?: string }) {
  //   return this.fileService.updateContent(file, contentChanges, options);
  // }

  async createFile(uri: string, options?: { content?: string, encoding?: string }) {
    return this.fileService.createFile(uri, options);
  }

  async getCurrentUserHome() {
    return this.fileService.getCurrentUserHome();
  }
}
