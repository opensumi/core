import { URI } from '@ali/ide-core-browser';
import { FileStat } from '@ali/ide-file-service';
import { TreeNode, CompositeTreeNode, ITree } from '@ali/ide-components';

export class Directory extends CompositeTreeNode {
  constructor(
    tree: ITree,
    public readonly parent: CompositeTreeNode | undefined,
    public readonly uri: URI = new URI(''),
    public name: string = '',
    public filestat: FileStat = { children: [], isDirectory: false, uri: '', lastModification: 0 },
    public tooltip: string,
  ) {
    super(tree, parent);
    if (!parent) {
      // 根节点默认展开节点
      this.setExpanded();
    }
  }
}

export class File extends TreeNode {
  constructor(
    tree: ITree,
    public readonly parent: CompositeTreeNode | undefined,
    public readonly uri: URI = new URI(''),
    public name: string = '',
    public filestat: FileStat = { children: [], isDirectory: false, uri: '', lastModification: 0 },
    public tooltip: string,
  ) {
    super(tree, parent);
  }
}
