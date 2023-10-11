import { TreeNode, ICompositeTreeNode, CompositeTreeNode, ITree } from '@opensumi/ide-components';
import { URI } from '@opensumi/ide-core-browser';
import { FileStat } from '@opensumi/ide-file-service';

export class Directory extends CompositeTreeNode {
  public static is(node: any): node is Directory {
    return CompositeTreeNode.is(node);
  }

  constructor(
    tree: ITree,
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
  }

  get displayName() {
    return this.name;
  }

  private updateName(name: string) {
    if (this.name !== name) {
      this.addMetadata('name', name);
    }
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

  updateMetaData(meta: { fileStat?: FileStat; tooltip?: string; name?: string; uri?: URI }) {
    const { fileStat, tooltip, name, uri } = meta;
    name && this.updateName(name);
    fileStat && this.updateFileStat(fileStat);
    uri && this.updateURI(uri);
    tooltip && this.updateToolTip(tooltip);
  }
}

export class File extends TreeNode {
  public static is(node: any): node is File {
    return TreeNode.is(node);
  }

  constructor(
    tree: ITree,
    parent: CompositeTreeNode | undefined,
    public uri: URI = new URI(''),
    name = '',
    public filestat: FileStat = { children: [], isDirectory: false, uri: '', lastModification: 0 },
    public tooltip: string,
  ) {
    super(tree as ITree, parent, undefined, { name });
  }

  get displayName() {
    return this.name;
  }

  private updateName(name: string) {
    if (this.name !== name) {
      this.addMetadata('name', name);
    }
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

  updateMetaData(meta: { fileStat?: FileStat; tooltip?: string; name?: string; uri?: URI }) {
    const { fileStat, tooltip, name, uri } = meta;
    name && this.updateName(name);
    fileStat && this.updateFileStat(fileStat);
    uri && this.updateURI(uri);
    tooltip && this.updateToolTip(tooltip);
  }
}
