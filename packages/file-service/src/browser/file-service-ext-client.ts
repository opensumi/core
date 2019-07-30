import { Injectable } from '@ali/common-di';
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

  async runExtFileSystemClientMethod(
    scheme: string,
    funName: string,
    args: any[],
  ) {

  }
}
