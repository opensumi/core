import { TreeNode, CompositeTreeNode, ITree } from '@opensumi/ide-components';
import { URI } from '@opensumi/ide-core-common';

import { ICommentAuthorInformation, ICommentsService, ICommentsThread } from '../../common/index';

export class CommentRoot extends CompositeTreeNode {
  static is(node: CommentFileNode | CommentRoot): node is CommentRoot {
    return !!node && !node.parent;
  }

  constructor(tree: ICommentsService) {
    super(tree as ITree, undefined);
  }

  get expanded() {
    return true;
  }
}

export class CommentFileNode extends CompositeTreeNode {
  public static is(node: any): node is CommentFileNode {
    return CompositeTreeNode.is(node) && 'threads' in node;
  }

  constructor(
    tree: ICommentsService,
    public threads: ICommentsThread[],
    public description: string = '',
    public tooltip: string,
    public icon: string,
    public resource: URI,
    parent: CommentRoot,
  ) {
    super(tree as ITree, parent);
    this.isExpanded = true;
  }

  get displayName() {
    return this.resource.displayName;
  }

  get badge() {
    return this.branchSize;
  }
}

export class CommentContentNode extends CompositeTreeNode {
  public static is(node: any): node is CommentContentNode {
    return CompositeTreeNode.is(node) && 'author' in node;
  }

  constructor(
    tree: ICommentsService,
    public thread: ICommentsThread,
    public comment: string,
    public description: string = '',
    public icon: string,
    public author: ICommentAuthorInformation,
    public resource: URI,
    parent: CommentFileNode | undefined,
  ) {
    super(tree as ITree, parent);
  }

  get expanded() {
    return true;
  }
}

export class CommentReplyNode extends TreeNode {
  public static is(node: any): node is CommentReplyNode {
    return TreeNode.is(node) && 'label' in node;
  }

  constructor(
    tree: ICommentsService,
    public thread: ICommentsThread,
    public label: string,
    public description: string = '',
    public icon: string,
    public resource: URI,
    parent: CommentContentNode | undefined,
  ) {
    super(tree as ITree, parent);
  }

  get displayName() {
    return this.label;
  }
}
