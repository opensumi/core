import { Injectable, Inject } from '@ali/common-di';
import { FileTreeAPI, CloudFile } from '../common/file-tree.defination';
import {servicePath as FileServicePath} from '@ali/ide-file-service';
/**
 * TODO: 依赖 Connection 模块定义好之后实现这个模块
 */
@Injectable()
export class FileTreeAPIImpl implements FileTreeAPI {

  constructor(@Inject(FileServicePath) protected readonly fileSevice) {}

  async getFiles(...paths: string[]) {
    const {content} = await this.fileSevice.resolveContent('/Users/franklife/work/ide/ac/ide-framework/README.md');
    return [{
      name: `name_${Date.now()}` + '\n' + content,
      path: `path_${Date.now()}`,
    }];
  }

  async createFile(file: CloudFile) {
    return file;
  }

  async deleteFile(file: CloudFile) {
    return;
  }
}
