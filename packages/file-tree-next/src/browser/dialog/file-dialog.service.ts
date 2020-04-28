import { Injectable, Autowired, Optional } from '@ali/common-di';
import {
  URI,
} from '@ali/ide-core-browser';
import { IFileTreeAPI } from '../../common';
import { IWorkspaceService } from '@ali/ide-workspace';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { Tree, ITreeNodeOrCompositeTreeNode, TreeNodeType, ITree } from '@ali/ide-components';
import { Directory } from '../file-tree-nodes';
import { FileStat } from '@ali/ide-file-service';

@Injectable({multiple: true})
export class FileTreeDialogService extends Tree {

  @Autowired(IFileTreeAPI)
  private fileTreeAPI: IFileTreeAPI;

  @Autowired(IWorkspaceService)
  private workspaceService: IWorkspaceService;

  @Autowired(LabelService)
  public labelService: LabelService;

  private workspaceRoot: FileStat;
  private _cacheNodesMap: Map<string, File | Directory> = new Map();

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
      let rootUri: URI;
      if (/^file:\/\//.test(path)) {
        rootUri = new URI(path);
      }
      rootUri = URI.file(path);
      const rootFileStat = await this.fileTreeAPI.resolveFileStat(rootUri);
      if (rootFileStat) {
        this.workspaceRoot = rootFileStat;
      }
    }
  }

  async resolveChildren(parent?: Directory) {
    if (!parent) {
      // 加载根目录
      if (!this.workspaceRoot) {
        this.workspaceRoot = (await this.workspaceService.roots)[0];
      }
      const { children } = await this.fileTreeAPI.resolveChildren(this as ITree, this.workspaceRoot);
      this.cacheNodes(children as (File | Directory)[]);
      this.root = children[0] as Directory;
      return children;
    } else {
      // 加载子目录
      if (parent.uri) {
        const { children } =  await this.fileTreeAPI.resolveChildren(this as ITree, parent.uri.toString(), parent);
        this.cacheNodes(children as (File | Directory)[]);
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
      const { children } = await this.fileTreeAPI.resolveChildren(this as ITree, rootFileStat);
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
    if (root.path.toString() !== '/') {
      while (root.path.toString() !== '/') {
        directory.push(root.withoutScheme().toString());
        root = root.parent;
      }
    } else {
      directory.push(root.withoutScheme().toString());
    }
    return directory;
  }

  sortComparator(a: ITreeNodeOrCompositeTreeNode, b: ITreeNodeOrCompositeTreeNode) {
    if (a.constructor === b.constructor) {
      // numeric 参数确保数字为第一排序优先级
      return a.name.localeCompare(b.name, 'kn', { numeric: true }) as any;
    }
    return a.type === TreeNodeType.CompositeTreeNode ? -1
      : b.type === TreeNodeType.CompositeTreeNode  ? 1
      : 0;
  }

  private cacheNodes(nodes: (File | Directory)[]) {
    // 切换工作区的时候需清理
    nodes.map((node) => {
      // node.path 不会重复，node.uri在软连接情况下可能会重复
      this._cacheNodesMap.set(node.path, node);
    });
  }

  dispose() {
    this._cacheNodesMap.clear();
  }
}
