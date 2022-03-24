import { TreeNode, ICompositeTreeNode, CompositeTreeNode, ITree } from '@opensumi/ide-components';
import { URI } from '@opensumi/ide-core-browser';
import { FileStat } from '@opensumi/ide-file-service';

import { IFileTreeService } from './index';

export class Directory extends CompositeTreeNode {
  private fileTreeService: IFileTreeService;
  private _displayName: string;

  constructor(
    tree: IFileTreeService,
    parent: ICompositeTreeNode | undefined,
    public uri: URI = new URI(''),
    name = '',
    public filestat: FileStat = { children: [], isDirectory: true, uri: '', lastModification: 0 },
    public tooltip: string,
    id?: number,
  ) {
    super(tree as ITree, parent, undefined, { name }, { disableCache: true });
    if (!parent) {
      // 根节点默认展开节点
      this.setExpanded();
    }
    this.fileTreeService = tree;
    this._uid = id || this._uid;
    TreeNode.setTreeNode(this._uid, this.path, this);
  }

  get displayName() {
    return this._displayName || this.name;
  }

  private updateName(name: string) {
    if (this.name !== name) {
      TreeNode.removeTreeNode(this._uid, this.path);
      this.name = name;
      // 更新name后需要重设节点路径索引
      TreeNode.setTreeNode(this._uid, this.path, this);
    }
  }

  private updateDisplayName(name: string) {
    this._displayName = name;
  }

  private updateURI(uri: URI) {
    this.uri = uri;
  }

  private updateFileStat(filestat: FileStat) {
    this.filestat = filestat;
  }

  private updateToolTip(tooltip: string) {
    this.tooltip = tooltip;
  }

  updateMetaData(meta: { fileStat?: FileStat; tooltip?: string; name?: string; displayName?: string; uri?: URI }) {
    const { fileStat, tooltip, name, displayName, uri } = meta;
    displayName && this.updateDisplayName(displayName);
    name && this.updateName(name);
    fileStat && this.updateFileStat(fileStat);
    uri && this.updateURI(uri);
    tooltip && this.updateToolTip(tooltip);
  }

  dispose() {
    super.dispose();
    this.fileTreeService.removeNodeCacheByPath(this.path);
  }
}

export class File extends TreeNode {
  private fileTreeService: IFileTreeService;
  private _displayName: string;

  constructor(
    tree: IFileTreeService,
    parent: CompositeTreeNode | undefined,
    public uri: URI = new URI(''),
    name = '',
    public filestat: FileStat = { children: [], isDirectory: false, uri: '', lastModification: 0 },
    public tooltip: string,
    id?: number,
  ) {
    super(tree as ITree, parent, undefined, { name }, { disableCache: true });
    this.fileTreeService = tree;
    this._uid = id || this._uid;
    TreeNode.setTreeNode(this._uid, this.path, this);
  }

  get displayName() {
    return this._displayName || this.name;
  }

  private updateName(name: string) {
    if (this.name !== name) {
      TreeNode.removeTreeNode(this._uid, this.path);
      this.name = name;
      // 更新name后需要重设节点路径索引
      TreeNode.setTreeNode(this._uid, this.path, this);
    }
  }

  private updateDisplayName(name: string) {
    this._displayName = name;
  }

  private updateURI(uri: URI) {
    this.uri = uri;
  }

  private updateFileStat(filestat: FileStat) {
    this.filestat = filestat;
  }

  private updateToolTip(tooltip: string) {
    this.tooltip = tooltip;
  }

  updateMetaData(meta: { fileStat?: FileStat; tooltip?: string; name?: string; displayName?: string; uri?: URI }) {
    const { fileStat, tooltip, name, displayName, uri } = meta;
    displayName && this.updateDisplayName(displayName);
    name && this.updateName(name);
    fileStat && this.updateFileStat(fileStat);
    uri && this.updateURI(uri);
    tooltip && this.updateToolTip(tooltip);
  }

  dispose() {
    super.dispose();
    this.fileTreeService.removeNodeCacheByPath(this.path);
  }
}
