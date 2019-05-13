import { FileTreeAPI, CloudFile } from '../common/file-tree.defination';
import { Injectable } from '@ali/common-di';

/**
 * TODO: 依赖 Connection 模块定义好之后实现这个模块
 */
@Injectable()
export class FileTreeAPIImpl implements FileTreeAPI {
  async getFiles(...paths: string[]) {
    return [{
      name: `name_${Date.now()}`,
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
