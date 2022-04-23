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
  ) {
    super(tree as ITree, parent, undefined, { name });
    if (!parent) {
      // 根节点默认展开节点
      this.isExpanded = true;
    }
    this.fileTreeService = tree;
  }

  get displayName() {
    return this._displayName || this.name;
  }

  private updateName(name: string) {
    if (this.name !== name) {
      this.name = name;
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
  ) {
    super(tree as ITree, parent, undefined, { name });
    this.fileTreeService = tree;
  }

  get displayName() {
    return this._displayName || this.name;
  }

  dispose() {
    super.dispose();
  }
}
