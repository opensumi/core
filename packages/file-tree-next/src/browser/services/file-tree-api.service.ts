
import { Injectable, Autowired } from '@ali/common-di';
import { FileStat } from '@ali/ide-file-service';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { ITree } from '@ali/ide-components';
import { Directory, File } from '../file-tree-nodes';
import { IFileTreeAPI } from '../../common';
import { URI } from '@ali/ide-core-common';

@Injectable()
export class FileTreeAPI implements IFileTreeAPI {

  @Autowired(IFileServiceClient)
  private fileServiceClient: IFileServiceClient;

  @Autowired()
  private labelService: LabelService;

  private userhomePath: URI;

  async resolveChildren(tree: ITree, path: string | FileStat, parent?: Directory) {
    let file: FileStat | undefined;
    if (!this.userhomePath) {
      const userhome = await this.fileServiceClient.getCurrentUserHome();
      if (userhome) {
        this.userhomePath = new URI(userhome.uri);
      }
    }
    if (typeof path === 'string') {
      file = await this.fileServiceClient.getFileStat(path);
    } else {
      file = await this.fileServiceClient.getFileStat(path.uri);
    }
    if (file) {
      return this.toNodes(tree, file, parent);
    } else {
      return [];
    }
  }

  toNodes(tree: ITree, filestat: FileStat, parent?: Directory) {
    // 如果为根目录，则返回其节点自身，否则返回子节点
    if (!parent) {
      return [this.toNode(tree, filestat, parent)];
    } else {
      if (filestat.children) {
        return filestat.children.map((child) => {
          return this.toNode(tree, child, parent);
        });
      }
    }
    return [];
  }
  /**
   * 转换FileStat对象为TreeNode
   */
  toNode(tree: ITree, filestat: FileStat, parent?: Directory): Directory | File {
    const uri = new URI(filestat.uri);
    const name = this.labelService.getName(uri);
    if (filestat.isDirectory && filestat.children) {
      return new Directory(
        tree,
        parent,
        uri,
        name,
        filestat,
      );
    } else {
      return new File(
        tree,
        parent,
        uri,
        name,
        filestat,
      );
    }
  }
}
