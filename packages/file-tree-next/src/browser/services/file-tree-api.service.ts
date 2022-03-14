import { Injectable, Autowired } from '@opensumi/di';
import { ITree } from '@opensumi/ide-components';
import { Path } from '@opensumi/ide-components/lib/utils';
import { EDITOR_COMMANDS, CorePreferences } from '@opensumi/ide-core-browser';
import { URI, localize, CommandService, formatLocalize } from '@opensumi/ide-core-common';
import * as paths from '@opensumi/ide-core-common/lib/path';
import { FileStat } from '@opensumi/ide-file-service';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';
import { IDialogService } from '@opensumi/ide-overlay';
import { IWorkspaceEditService } from '@opensumi/ide-workspace-edit';

import { IFileTreeAPI, IFileTreeService } from '../../common';
import { Directory, File } from '../../common/file-tree-node.define';

@Injectable()
export class FileTreeAPI implements IFileTreeAPI {
  @Autowired(IFileServiceClient)
  protected fileServiceClient: IFileServiceClient;

  @Autowired(IWorkspaceEditService)
  private workspaceEditService: IWorkspaceEditService;

  @Autowired(CommandService)
  private commandService: CommandService;

  @Autowired(CorePreferences)
  private readonly corePreferences: CorePreferences;

  @Autowired(IDialogService)
  private readonly dialogService: IDialogService;
  private cacheFileStat: Map<string, FileStat> = new Map();
  private cacheNodeID: Map<string, number> = new Map();

  private userhomePath: URI;

  async resolveChildren(tree: IFileTreeService, path: string | FileStat, parent?: Directory, compact?: boolean) {
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
        const parentURI = new URI(file.children[0].uri);
        if (!!parent && parent.parent) {
          const parentName = (parent.parent as Directory).uri.relative(parentURI)?.toString();
          if (parentName && parentName !== parent.name) {
            const prePath = parent.path;
            tree.removeNodeCacheByPath(prePath);
            parent.updateName(parentName);
            parent.updateDisplayName(parentName);
            parent.updateURI(parentURI);
            parent.updateFileStat(file.children[0]);
            parent.updateToolTip(this.getReadableTooltip(parentURI));
            // Re-Cache Node
            tree.reCacheNode(parent, prePath);
          }
        }
        return await this.resolveChildren(tree, file.children[0].uri, parent, compact);
      } else {
        // 为文件树节点新增isInSymbolicDirectory属性，用于探测节点是否处于软链接文件中
        const filestat = {
          ...file,
          isInSymbolicDirectory: parent?.filestat.isSymbolicLink || parent?.filestat.isInSymbolicDirectory,
        };
        return {
          children: this.toNodes(tree, filestat, parent),
          filestat,
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
    const file = await this.fileServiceClient.getFileStat(path);
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
        return filestat.children.map((child) => this.toNode(tree, child, parent));
      }
    }
    return [];
  }

  /**
   * 转换FileStat对象为TreeNode
   */
  toNode(tree: ITree, filestat: FileStat, parent?: Directory, presetName?: string): Directory | File {
    const uri = new URI(filestat.uri);
    // 这里的name主要用于拼接节点路径，即path属性, 必须遵循路径原则
    // labelService可根据uri参数提供不同的展示效果
    const name = presetName ? presetName : uri.displayName;
    let node: Directory | File;
    if (!this.cacheFileStat.has(filestat.uri)) {
      this.cacheFileStat.set(filestat.uri, filestat);
    }
    if (filestat.isDirectory) {
      node = new Directory(
        tree as any,
        parent,
        uri,
        name,
        filestat,
        this.getReadableTooltip(uri),
        parent && this.cacheNodeID.get(new Path(parent.path).join(name).toString()),
      );
    } else {
      node = new File(
        tree as any,
        parent,
        uri,
        name,
        filestat,
        this.getReadableTooltip(uri),
        parent && this.cacheNodeID.get(new Path(parent.path).join(name).toString()),
      );
    }
    // 用于固定各个节点的ID，防止文件操作出现定位错误
    this.cacheNodeID.set(node.path, node.id);
    return node;
  }

  async mvFiles(fromFiles: URI[], targetDir: URI) {
    const error: string[] = [];
    for (const from of fromFiles) {
      if (from.isEqualOrParent(targetDir)) {
        return;
      }
    }
    // 合并具有包含关系的文件移动
    const sortedFiles = fromFiles.sort((a, b) => a.toString().length - b.toString().length);
    const mergeFiles: URI[] = [];
    for (const file of sortedFiles) {
      if (mergeFiles.length > 0 && mergeFiles.find((exist) => exist.isEqualOrParent(file))) {
        continue;
      }
      mergeFiles.push(file);
    }
    if (this.corePreferences['explorer.confirmMove']) {
      const ok = localize('file.confirm.move.ok');
      const cancel = localize('file.confirm.move.cancel');
      const confirm = await this.dialogService.warning(
        formatLocalize(
          'file.confirm.move',
          `[ ${mergeFiles.map((uri) => uri.displayName).join(',')} ]`,
          targetDir.displayName,
        ),
        [cancel, ok],
      );
      if (confirm !== ok) {
        return;
      }
    }
    for (const from of mergeFiles) {
      const filestat = this.cacheFileStat.get(from.toString());
      const res = await this.mv(from, targetDir.resolve(from.displayName), filestat && filestat.isDirectory);
      if (res) {
        error.push(res);
      }
    }
    return error;
  }

  async mv(from: URI, to: URI, isDirectory = false) {
    try {
      await this.workspaceEditService.apply({
        edits: [
          {
            newResource: to,
            oldResource: from,
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
            newResource: uri,
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
      await this.workspaceEditService.apply({
        edits: [
          {
            newResource: uri,
            options: {
              isDirectory: true,
            },
          },
        ],
      });
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
            oldResource: uri,
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
      exists = await this.fileServiceClient.access(to.toString());
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
        exists = await this.fileServiceClient.access(to.toString());
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
