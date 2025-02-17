import { Autowired, Injectable, Optional } from '@opensumi/di';
import { ITreeNodeOrCompositeTreeNode, Tree, TreeNodeType } from '@opensumi/ide-components';
import { Schemes, URI } from '@opensumi/ide-core-browser';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { FileStat, IFileServiceClient } from '@opensumi/ide-file-service';
import { IDialogService } from '@opensumi/ide-overlay';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IFileTreeAPI, IFileTreeService } from '../../common';
import { Directory } from '../../common/file-tree-node.define';
import { FileTreeService } from '../file-tree.service';
import { FileTreeModelService } from '../services/file-tree-model.service';

import { FileTreeDialogModel } from './file-dialog-model.service';
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

  @Autowired(IFileServiceClient)
  protected readonly fileServiceClient: IFileServiceClient;

  @Autowired(WorkbenchEditorService)
  workbenchEditorService: WorkbenchEditorService;

  @Autowired(IDialogService)
  protected dialogService: IDialogService;

  @Autowired(FileTreeModelService)
  protected fileTreeModelService: FileTreeModelService;

  @Autowired(IFileTreeService)
  private readonly fileTreeService: FileTreeService;

  private workspaceRoot: FileStat;

  public _whenReady: Promise<void>;

  showFilePathSearch: boolean;

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

  async saveAs(options: { oldFilePath: string; newFilePath: string }) {
    const { oldFilePath, newFilePath } = options;
    if (!oldFilePath || !newFilePath) {
      throw new Error('oldFilePath and newFilePath are required');
    }
    await this.createFile(options);
    try {
      const openUri: URI = URI.file(options.newFilePath);
      const EDITOR_OPTIONS = {
        preview: false,
        focus: true,
        replace: true,
        forceClose: true,
        disableNavigate: false,
      };
      await this.workbenchEditorService.open(openUri, EDITOR_OPTIONS);
      await this.fileTreeModelService.clearFileSelectedDecoration();
      const file = this.fileTreeService.getNodeByPathOrUri(openUri);
      if (file) {
        await this.fileTreeModelService.activeFileDecoration(file);
      }
    } catch (error) {
      throw new Error(`Failed to open saveAs file: ${error.message}`);
    }
  }

  async createFile(options: { oldFilePath: string; newFilePath: string }) {
    try {
      const { oldFilePath, newFilePath } = options;
      const fileStat = await this.fileServiceClient.getFileStat(oldFilePath);

      if (!fileStat) {
        throw new Error(`Source file not found: ${oldFilePath}`);
      }

      const { content } = await this.fileServiceClient.readFile(oldFilePath);

      await this.fileServiceClient.createFile(newFilePath, {
        content: content.toString(),
        encoding: 'utf8',
        overwrite: true,
      });
    } catch (e) {
      throw new Error(`Failed to create file: ${e.message}`);
    }
  }

  renderCustomMsg() {
    return null;
  }

  async getDefaultFilePath(_model: FileTreeDialogModel, defaultPath: string) {
    return defaultPath;
  }

  dispose() {
    super.dispose();
  }
}
