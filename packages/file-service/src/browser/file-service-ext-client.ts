import { Injectable } from '@ali/common-di';
import { isFunction, getDebugLogger } from '@ali/ide-core-common';
import {
  IMainThreadFileSystem,
  IFileServiceExtClient,
} from '../common/ext-file-system';

const log = getDebugLogger();

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
      return log.warn('Not set extFileSystemClient!');
    }
    const result = await this.extFileSystemClient.runProviderMethod(scheme, funName, args);
    log.log(`runExtFileSystemProviderMethod`, result);
    return result;
  }

  async runExtFileSystemClientMethod(funName: string, args: any[]): Promise<any> {
    if (!this.extFileSystemClient) {
      return log.warn('Not set extFileSystemClient!');
    }
    if (!isFunction(this.extFileSystemClient[funName])) {
      return log.warn(`Not find this method ${funName} of extFileSystemClient`);
    }
    return await this.extFileSystemClient[funName].apply(this.extFileSystemClient, args);
  }
}
