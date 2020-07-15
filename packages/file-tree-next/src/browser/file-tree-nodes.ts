import { URI } from '@ali/ide-core-browser';
import { FileStat } from '@ali/ide-file-service';
import { TreeNode, CompositeTreeNode, ITree } from '@ali/ide-components';
import { FileTreeService } from './file-tree.service';

export class Directory extends CompositeTreeNode {

  private fileTreeService: FileTreeService;

  constructor(
    tree: FileTreeService,
    public readonly parent: CompositeTreeNode | undefined,
    public uri: URI = new URI(''),
    public name: string = '',
    public filestat: FileStat = { children: [], isDirectory: false, uri: '', lastModification: 0 },
    public tooltip: string,
    id?: number,
  ) {
    super(tree as ITree, parent, undefined, { name }, { disableCache: false });
    if (!parent) {
      // 根节点默认展开节点
      this.setExpanded();
    }
    this.fileTreeService = tree;
    this._uid = id || this._uid;
    TreeNode.setTreeNode(this._uid, this.path, this);
  }

  updateName(name: string) {
    this.name = name;
    TreeNode.removeTreeNode(this._uid);
    // 更新name后需要重设节点路径索引
    TreeNode.setTreeNode(this._uid, this.path, this);
  }

  updateURI(uri: URI) {
    this.uri = uri;
  }

  updateFileStat(filestat: FileStat) {
    this.filestat = filestat;
  }

  updateToolTip(tooltip: string) {
    this.tooltip = tooltip;
  }

  dispose() {
    super.dispose();
    this.fileTreeService.removeNodeCacheByPath(this.path);
  }
}

export class File extends TreeNode {
  private fileTreeService: FileTreeService;

  constructor(
    tree: FileTreeService,
    public readonly parent: CompositeTreeNode | undefined,
    public uri: URI = new URI(''),
    public name: string = '',
    public filestat: FileStat = { children: [], isDirectory: false, uri: '', lastModification: 0 },
    public tooltip: string,
    id?: number,
  ) {
    super(tree as ITree, parent, undefined, { name }, { disableCache: false });
    this.fileTreeService = tree;
    this._uid = id || this._uid;
    TreeNode.setTreeNode(this._uid, this.path, this);
  }

  updateName(name: string) {
    this.name = name;
    TreeNode.removeTreeNode(this._uid);
    // 更新name后需要重设节点路径索引
    TreeNode.setTreeNode(this._uid, this.path, this);
  }

  updateURI(uri: URI) {
    this.uri = uri;
  }

  updateFileStat(filestat: FileStat) {
    this.filestat = filestat;
  }

  updateToolTip(tooltip: string) {
    this.tooltip = tooltip;
  }

  dispose() {
    super.dispose();
    this.fileTreeService.removeNodeCacheByPath(this.path);
  }
}
