
import { Injectable, Autowired } from '@ali/common-di';
import { FileStat } from '@ali/ide-file-service';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { ITree } from '@ali/ide-components';
import { Directory, File } from '../file-tree-nodes';
import { IFileTreeAPI } from '../../common';
import { URI, localize, CommandService, formatLocalize } from '@ali/ide-core-common';
import { IDialogService } from '@ali/ide-overlay';
import { IWorkspaceEditService } from '@ali/ide-workspace-edit';
import { EDITOR_COMMANDS, CorePreferences } from '@ali/ide-core-browser';
import * as paths from '@ali/ide-core-common/lib/path';

@Injectable()
export class FileTreeAPI implements IFileTreeAPI {

  @Autowired(IFileServiceClient)
  private fileServiceClient: IFileServiceClient;

  @Autowired()
  private labelService: LabelService;

  @Autowired(IWorkspaceEditService)
  private workspaceEditService: IWorkspaceEditService;

  @Autowired(CommandService)
  private commandService: CommandService;

  @Autowired(CorePreferences)
  private readonly corePreferences: CorePreferences;

  @Autowired(IDialogService)
  private readonly dialogService: IDialogService;
  private cacheFileStat: Map<string, FileStat> = new Map();

  private userhomePath: URI;

  async resolveChildren(tree: ITree, path: string | FileStat, parent?: Directory, compact?: boolean) {
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
      if (file.children?.length === 1 && file.children[0].isDirectory && compact) {
        return await this.resolveChildren(tree, file.children[0].uri, parent, compact);
      } else {
        return {
          children: this.toNodes(tree, file, parent),
          filestat: file,
        };
      }
    } else {
      return {
        children: [],
        filestat: null,
      };
    }
  }

  async resolveNodeByPath(tree: ITree, path: string, parent?: Directory) {
    const  file = await this.fileServiceClient.getFileStat(path);
    if (file) {
      return this.toNode(tree, file, parent);
    }
  }

  async resolveFileStat(uri: URI) {
    return await this.fileServiceClient.getFileStat(uri.toString());
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
  toNode(tree: ITree, filestat: FileStat, parent?: Directory, presetName?: string): Directory | File {
    const uri = new URI(filestat.uri);
    // 这里的name主要用于拼接节点路径，即path属性
    const name = presetName ? presetName : this.labelService.getName(uri);
    if (!this.cacheFileStat.has(filestat.uri)) {
      this.cacheFileStat.set(filestat.uri, filestat);
    }
    if (filestat.isDirectory) {
      return new Directory(
        tree as any,
        parent,
        uri,
        name,
        filestat,
        this.getReadableTooltip(uri),
      );
    } else {
      return new File(
        tree as any,
        parent,
        uri,
        name,
        filestat,
        this.getReadableTooltip(uri),
      );
    }
  }

  async mvFiles(fromFiles: URI[], targetDir: URI) {
    const error: string[] = [];
    for (const from of fromFiles) {
      if (from.isEqualOrParent(targetDir)) {
        return;
      }
    }
    if (this.corePreferences['explorer.confirmMove']) {
      const ok = localize('file.confirm.move.ok');
      const cancel = localize('file.confirm.move.cancel');
      const confirm = await this.dialogService.warning(formatLocalize('file.confirm.move', `[${fromFiles.map((uri) => uri.displayName).join(',')}]`, targetDir.displayName), [cancel, ok]);
      if (confirm !== ok) {
        return;
      }
    }
    for (const from of fromFiles) {
      const filestat = this.cacheFileStat.get(from.toString());
      const res = await this.mv(from, targetDir.resolve(from.displayName), filestat && filestat.isDirectory);
      if (!!res) {
        error.push(res);
      }
    }
    return error;
  }

  async mv(from: URI, to: URI, isDirectory: boolean = false) {
    const exists = await this.fileServiceClient.exists(to.toString());
    if (exists) {
      return localize('file.move.existMessage');
    }
    try {
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
    } catch (e) {
      return e.message;
    }
    return;
  }

  async createFile(uri: URI) {
    try {
      await this.workspaceEditService.apply({
        edits: [
          {
            newUri: uri,
            options: {},
          },
        ],
      });
    } catch (e) {
      return e.message;
    }
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri, { disableNavigate: true });
    return;
  }

  async createDirectory(uri: URI) {
    try {
      await this.fileServiceClient.createFolder(uri.toString());
    } catch (e) {
      return e.message;
    }
    return;
  }

  async delete(uri: URI) {
    try {
      await this.workspaceEditService.apply({
        edits: [
          {
            oldUri: uri,
            options: {},
          },
        ],
      });
      return;
    } catch (e) {
      return e.message;
    }
  }

  async copyFile(from: URI, to: URI) {
    let idx = 1;
    let exists;
    try {
      exists = await this.fileServiceClient.exists(to.toString());
    } catch (e) {
      return e.message;
    }
    while (exists) {
      const name = to.displayName.replace(/\Wcopy\W\d+/, '');
      const extname = paths.extname(name);
      const basename = paths.basename(name, extname);
      const newFileName = `${basename} copy ${idx}${extname}`;
      to = to.parent.resolve(newFileName);
      idx++;
      try {
        exists = await this.fileServiceClient.exists(to.toString());
      } catch (e) {
        return;
      }
    }
    try {
      return await this.fileServiceClient.copy(from.toString(), to.toString());
    } catch (e) {
      return e.message;
    }
  }

  /**
   * 替换用户目录为 ~
   * 移除协议头文本 file://
   *
   * @param {URI} path
   * @returns
   * @memberof FileTreeAPI
   */
  public getReadableTooltip(path: URI) {
    const pathStr = path.toString();
    const userhomePathStr = this.userhomePath && this.userhomePath.toString();
    if (!this.userhomePath) {
      return decodeURIComponent(path.withScheme('').toString());
    }
    if (this.userhomePath.isEqualOrParent(path)) {
      return decodeURIComponent(pathStr.replace(userhomePathStr, '~'));
    }
    return decodeURIComponent(path.withScheme('').toString());
  }
}
