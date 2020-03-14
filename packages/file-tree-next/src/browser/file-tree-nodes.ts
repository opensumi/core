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
  ) {
    super(tree, parent);
  }
}

export class File extends TreeNode {

  public selected: boolean = false;
  public focused: boolean = false;

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
