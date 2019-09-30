
import { Injectable, Autowired } from '@ali/common-di';
import { FileTreeAPI, IFileTreeItem } from '../common/file-tree.defination';
import { FileStat } from '@ali/ide-file-service';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { IWorkspaceEditService } from '@ali/ide-workspace-edit';
import { EDITOR_COMMANDS, URI, CommandService  } from '@ali/ide-core-browser';

let id = 0;

@Injectable()
export class FileTreeAPIImpl implements FileTreeAPI {

  @Autowired(IFileServiceClient)
  private fileServiceClient: IFileServiceClient;

  @Autowired(IWorkspaceEditService)
  private workspaceEditService: IWorkspaceEditService;

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired()
  labelService: LabelService;

  private userhomePath: URI;

  async getFiles(path: string | FileStat, parent?: IFileTreeItem | undefined) {
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
      file = {
        ...file,
      } as FileStat;
    }
    if (file) {
      const result = await this.fileStat2FileTreeItem(file, parent, file.isSymbolicLink || false);
      return [ result ];
    } else {
      return [];
    }
  }

  async getFileStat(path: string) {
    const stat: any = await this.fileServiceClient.getFileStat(path);
    return stat;
  }

  async createFile(uri: URI) {
    await this.workspaceEditService.apply({
      edits: [
        {
          newUri: uri,
          options: {},
        },
      ],
    });
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri );
  }

  async createFolder(uri: URI) {
    await this.fileServiceClient.createFolder(uri.toString());
  }

  async exists(uri: URI) {
   return await this.fileServiceClient.exists(uri.toString());
  }

  async deleteFile(uri: URI) {
    await this.workspaceEditService.apply({
      edits: [
        {
          oldUri: uri,
          options: {},
        },
      ],
    });
  }

  async moveFile(from: URI, to: URI, isDirectory: boolean = false) {
    await this.workspaceEditService.apply({
      edits: [
        {
          newUri: to,
          oldUri: from,
          options: {
            isDirectory,
            overwrite: true,
          },
        },
      ],
    });
  }

  async copyFile(from: URI, to: URI) {
    this.fileServiceClient.copy(from.toString(), to.toString());
  }

  /**
   * 转换FileStat对象为FileTreeItem
   *
   * @param {FileStat} filestat
   * @param {(IFileTreeItem | undefined)} parent
   * @param {boolean} isSymbolicLink
   * @returns {IFileTreeItem}
   * @memberof FileTreeAPIImpl
   */
  fileStat2FileTreeItem(filestat: FileStat, parent: IFileTreeItem | undefined, isSymbolicLink: boolean): IFileTreeItem {
    const result: IFileTreeItem = {
      id: 0,
      uri: new URI(''),
      name: '',
      filestat: {
        isDirectory: false,
        lastModification: 0,
        uri: '',
      },
      parent,
      depth: 0,
      priority: 1,
    };
    const uri = new URI(filestat.uri);
    const icon = this.labelService.getIcon(uri, {isDirectory: filestat.isDirectory, isSymbolicLink: filestat.isSymbolicLink});
    const name = this.labelService.getName(uri);
    if (filestat.isDirectory && filestat.children) {
      let children: IFileTreeItem[] = [];
      const childrenFileStat = filestat.children.filter((stat) => !!stat);
      for (const child of childrenFileStat) {
        const item = this.fileStat2FileTreeItem(child, result, isSymbolicLink);
        children.push(item);
      }
      children = this.sortByNumberic(children);
      Object.assign(result, {
        id: id++,
        uri,
        filestat: {
          ...filestat,
          isSymbolicLink: filestat.isSymbolicLink || isSymbolicLink,
        },
        tooltip: this.getReadableTooltip(uri),
        icon,
        name,
        children,
        parent,
      });
    } else {
      Object.assign(result, {
        id: id++,
        uri,
        filestat: {
          ...filestat,
          isSymbolicLink,
        },
        tooltip: this.getReadableTooltip(uri),
        icon,
        name,
        parent,
      });
    }
    return result;
  }

  /**
   * 替换用户目录为 ~
   * 移除协议头文本 file://
   *
   * @param {URI} path
   * @returns
   * @memberof FileTreeAPIImpl
   */
  getReadableTooltip(path: URI) {
    const pathStr = path.toString();
    const userhomePathStr = this.userhomePath && this.userhomePath.toString();
    if (!this.userhomePath) {
      return path.withScheme('').toString();
    }
    if (this.userhomePath.isEqualOrParent(path)) {
      return pathStr.replace(userhomePathStr, '~');
    }
    return path.withScheme('').toString();
  }

  generatorFileFromFilestat(filestat: FileStat, parent: IFileTreeItem): IFileTreeItem {
    const uri = new URI(filestat.uri);
    const result: IFileTreeItem = {
      id: id++,
      uri,
      name: this.labelService.getName(uri),
      icon: this.labelService.getIcon(uri, filestat),
      filestat,
      parent,
      depth: parent.depth ? parent.depth + 1 : 0,
      priority: 1,
    };
    if (filestat.isDirectory) {
      return {
        ...result,
        children: [],
        expanded: false,
      };
    }
    return result;
  }

  generatorTempFile(uri: URI, parent: IFileTreeItem, isDirectory: boolean = false): IFileTreeItem {
    const filestat: FileStat = {
      uri: uri.toString(),
      isDirectory,
      isSymbolicLink: false,
      isTemporaryFile: true,
      lastModification: new Date().getTime(),
    };
    const result: IFileTreeItem = {
      id: id++,
      uri,
      name: this.labelService.getName(uri),
      icon: this.labelService.getIcon(uri, filestat),
      filestat,
      parent,
      depth: parent.depth ? parent.depth + 1 : 0,
      // 用于让新建的文件顺序排序优先于普通文件
      priority: 10,
    };
    if (isDirectory) {
      return {
        ...result,
        children: [],
        expanded: false,
      };
    }
    return result;
  }

  generatorTempFolder(uri: URI, parent: IFileTreeItem): IFileTreeItem {
    return this.generatorTempFile(uri, parent, true);
  }

  sortByNumberic(files: IFileTreeItem[]): IFileTreeItem[] {
    return files.sort((a: IFileTreeItem, b: IFileTreeItem) => {
      if (a.filestat.isDirectory && b.filestat.isDirectory || !a.filestat.isDirectory && !b.filestat.isDirectory) {
        if (a.priority > b.priority) {
          return -1;
        }
        if (a.priority < b.priority) {
          return 1;
        }
        // numeric 参数确保数字为第一排序优先级
        return a.name.localeCompare(b.name, 'kn', { numeric: true });
      } else if (a.filestat.isDirectory && !b.filestat.isDirectory) {
        return -1;
      } else if (!a.filestat.isDirectory && b.filestat.isDirectory) {
        return 1;
      } else {
        return a.priority > b.priority ? -1 : 1;
      }
    });
  }
}
