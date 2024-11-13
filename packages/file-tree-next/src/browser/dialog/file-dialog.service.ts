import { Autowired, Injectable, Optional } from '@opensumi/di';
import { ITreeNodeOrCompositeTreeNode, Tree, TreeNodeType } from '@opensumi/ide-components';
import { Schemes, URI } from '@opensumi/ide-core-browser';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { FileStat } from '@opensumi/ide-file-service';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IFileTreeAPI } from '../../common';
import { Directory } from '../../common/file-tree-node.define';

import { FileDialogContextKey } from './file-dialog.contextkey';

@Injectable({ multiple: true })
export class FileTreeDialogService extends Tree {
  @Autowired(IFileTreeAPI)
  private fileTreeAPI: IFileTreeAPI;

  @Autowired(IWorkspaceService)
  private workspaceService: IWorkspaceService;

  @Autowired(LabelService)
  public labelService: LabelService;

  @Autowired(FileDialogContextKey)
  private fileDialogContextKey: FileDialogContextKey;

  private workspaceRoot: FileStat;

  public _whenReady: Promise<void>;

  constructor(@Optional() root: string) {
    super();
    this._whenReady = this.resolveWorkspaceRoot(root);
  }

  get whenReady() {
    return this._whenReady;
  }

  async resolveWorkspaceRoot(path: string) {
    if (path) {
      const rootUri: URI = new URI(path).withScheme(Schemes.file);
      const rootFileStat = await this.fileTreeAPI.resolveFileStat(rootUri);
      if (rootFileStat) {
        this.workspaceRoot = rootFileStat;
      }
    }
  }

  async resolveChildren(parent?: Directory) {
    if (!parent) {
      // 加载根目录
      if (!this.workspaceRoot) {
        this.workspaceRoot = (await this.workspaceService.roots)[0];
      }
      const { children } = await this.fileTreeAPI.resolveChildren(this, this.workspaceRoot);
      this.root = children[0] as Directory;
      return children;
    } else {
      // 加载子目录
      if (parent.uri) {
        const { children } = await this.fileTreeAPI.resolveChildren(this, parent.uri.toString(), parent);
        return children;
      }
    }
    return [];
  }

  async resolveRoot(path: string) {
    let rootUri: URI;
    if (/^file:\/\//.test(path)) {
      rootUri = new URI(path);
    }
    rootUri = URI.file(path);
    const rootFileStat = await this.fileTreeAPI.resolveFileStat(rootUri);
    if (rootFileStat) {
      const { children } = await this.fileTreeAPI.resolveChildren(this, rootFileStat);
      this.root = children[0] as Directory;
      return children;
    }
  }

  getDirectoryList() {
    const directory: string[] = [];
    if (!this.root) {
      return directory;
    }
    let root = new URI(this.workspaceRoot.uri);
    if (root && root.parent) {
      while (root.parent) {
        const folder = root.codeUri.fsPath;
        if (directory.indexOf(folder) >= 0) {
          break;
        }
        directory.push(folder);
        root = root.parent;
      }
    } else {
      directory.push(root.codeUri.fsPath.toString());
    }
    return directory;
  }

  sortComparator(a: ITreeNodeOrCompositeTreeNode, b: ITreeNodeOrCompositeTreeNode) {
    if (a.constructor === b.constructor) {
      // 默认让弹窗的文件里面，.开头的文件后置展示
      if (a.name.startsWith('.') && !b.name.startsWith('.')) {
        return 1;
      }
      if (!a.name.startsWith('.') && b.name.startsWith('.')) {
        return -1;
      }
      // numeric 参数确保数字为第一排序优先级
      return a.name.localeCompare(b.name, 'kn', { numeric: true }) as any;
    }
    return a.type === TreeNodeType.CompositeTreeNode ? -1 : b.type === TreeNodeType.CompositeTreeNode ? 1 : 0;
  }

  initContextKey(dom: HTMLDivElement) {
    if (!dom) {
      return;
    }
    this.fileDialogContextKey.initScopedContext(dom);
  }

  get contextKey() {
    return this.fileDialogContextKey;
  }

  dispose() {
    super.dispose();
  }
}
