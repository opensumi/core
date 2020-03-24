
import { Injectable, Autowired } from '@ali/common-di';
import { FileStat } from '@ali/ide-file-service';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { ITree } from '@ali/ide-components';
import { Directory, File } from '../file-tree-nodes';
import { IFileTreeAPI } from '../../common';
import { URI, localize, CommandService, formatLocalize } from '@ali/ide-core-common';
import { IMessageService, IDialogService } from '@ali/ide-overlay';
import { IWorkspaceEditService } from '@ali/ide-workspace-edit';
import { EDITOR_COMMANDS, CorePreferences } from '@ali/ide-core-browser';

@Injectable()
export class FileTreeAPI implements IFileTreeAPI {

  @Autowired(IFileServiceClient)
  private fileServiceClient: IFileServiceClient;

  @Autowired()
  private labelService: LabelService;

  @Autowired(IMessageService)
  private messageService: IMessageService;

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

  async resolveNodeByPath(tree: ITree, path: string, parent?: Directory) {
    const  file = await this.fileServiceClient.getFileStat(path);
    if (file) {
      return this.toNode(tree, file, parent);
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
    if (!this.cacheFileStat.has(filestat.uri)) {
      this.cacheFileStat.set(filestat.uri, filestat);
    }
    if (filestat.isDirectory) {
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

  async mvFiles(fromFiles: URI[], targetDir: URI) {
    for (const from of fromFiles) {
      if (from.isEqualOrParent(targetDir)) {
        return false;
      }
    }
    if (this.corePreferences['explorer.confirmMove']) {
      const ok = localize('file.confirm.move.ok');
      const cancel = localize('file.confirm.move.cancel');
      const confirm = await this.dialogService.warning(formatLocalize('file.confirm.move', `[${fromFiles.map((uri) => uri.displayName).join(',')}]`, targetDir.displayName), [cancel, ok]);
      if (confirm !== ok) {
        return false;
      }
    }
    for (const from of fromFiles) {
      const filestat = this.cacheFileStat.get(from.toString());
      const res = await this.mv(from, targetDir.resolve(from.displayName), filestat && filestat.isDirectory);
      if (!res) {
        return false;
      }
    }
    return true;
  }

  async mv(from: URI, to: URI, isDirectory: boolean = false) {
    const exists = await this.fileServiceClient.exists(to.toString());
    if (exists) {
      this.messageService.error(localize('file.move.existMessage'));
      return false;
    }
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
    return true;
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
      return false;
    }
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri);
    return true;
  }

  async createDirectory(uri: URI) {
    try {
      await this.fileServiceClient.createFolder(uri.toString());
    } catch (e) {
      return false;
    }
    return true;
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
      return true;
    } catch (e) {
      return false;
    }
  }
}
