import { URI } from '@ali/ide-core-browser';
import { FileStat } from '@ali/ide-file-service';
import { TreeNode, CompositeTreeNode, ITree } from '@ali/ide-components';

export class Directory extends CompositeTreeNode {

  private readonly _uri: URI;
  private readonly _name: string;
  private readonly _filestat: FileStat;

  constructor(
    tree: ITree,
    parent: CompositeTreeNode | undefined,
    uri: URI = new URI(''),
    name: string = '',
    filestat: FileStat = { children: [], isDirectory: false, uri: '', lastModification: 0 },
  ) {
    super(tree, parent);
    this._uri = uri;
    this._name = name;
    this._filestat = filestat;
    if (!parent) {
      // 根节点默认展开节点
      this.setExpanded();
    }
  }

  get uri() {
    return this._uri;
  }

  get name() {
    return this._name;
  }

  get filestat() {
    return this._filestat;
  }

}

export class File extends TreeNode {
  constructor(
    tree: ITree,
    public readonly parent: CompositeTreeNode | undefined,
    public readonly uri: URI = new URI(''),
    public name: string = '',
    public filestat: FileStat = { children: [], isDirectory: false, uri: '', lastModification: 0 },
  ) {
    super(tree, parent);
  }
}
