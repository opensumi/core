import { Injectable } from '@ali/common-di';
import { isFunction } from '@ali/ide-core-common';
import {
  IMainThreadFileSystem,
  IFileServiceExtClient,
} from '../common/ext-file-system';

@Injectable()
export class FileServiceExtClient implements IFileServiceExtClient {
  private extFileSystemClient: IMainThreadFileSystem;

  setExtFileSystemClient(client) {
    this.extFileSystemClient = client;
  }

  async runExtFileSystemProviderMethod(
    scheme: string,
    funName: string,
    args: any[],
  ) {
    if (!this.extFileSystemClient) {
      return console.warn('Not set extFileSystemClient!');
    }
    return await this.extFileSystemClient.runProviderMethod(scheme, funName, args);
  }

  async runExtFileSystemClientMethod(funName: string, args: any[]): Promise<any> {
    if (!this.extFileSystemClient) {
      return console.warn('Not set extFileSystemClient!');
    }
    if (!isFunction(this.extFileSystemClient[funName])) {
      return console.warn(`Not find this method ${funName} of extFileSystemClient`);
    }
    return await this.extFileSystemClient[funName].apply(this.extFileSystemClient, args);
  }
}
