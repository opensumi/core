import { TreeNode, CompositeTreeNode, ITree } from '@opensumi/ide-components';
import { URI, memoize, path } from '@opensumi/ide-core-browser';

import { ISCMResourceGroup, ISCMResource } from '../../../common';
import { isSCMResourceGroup } from '../../scm-util';

import { ISCMTreeNodeDescription, collectSCMResourceDesc } from './scm-tree-api';
import { SCMTreeService } from './scm-tree.service';

export class SCMResourceRoot extends CompositeTreeNode {
  static is(node: any): node is SCMResourceRoot {
    return !!node && !node.parent;
  }

  constructor(tree: SCMTreeService, private readonly isTree?: boolean) {
    super(tree as ITree, undefined);
  }

  get name() {
    return `SCMTree_${this.isTree ? 'Tree' : 'List'}_${this.id}`;
  }

  get expanded() {
    return true;
  }

  dispose() {
    super.dispose();
  }
}

export class SCMResourceGroup extends CompositeTreeNode {
  public static is(node: any): node is SCMResourceGroup {
    return (
      CompositeTreeNode.is(node) &&
      !!(node as SCMResourceGroup).resource &&
      isSCMResourceGroup((node as SCMResourceGroup).resource)
    );
  }

  constructor(
    tree: SCMTreeService,
    parent: CompositeTreeNode | undefined,
    public raw: ISCMTreeNodeDescription<ISCMResourceGroup>,
    public readonly resource: ISCMResourceGroup,
    id?: number,
  ) {
    super(tree as ITree, parent, undefined, { name: resource.label });
    this.id = id || this.id;
    // 目录节点默认全部展开
    this.isExpanded = true;
  }

  @memoize
  get displayName() {
    return this.resource.label;
  }

  @memoize
  get uri(): URI {
    // 虚拟的 uri，为了跟 tree 配合使用
    return new URI(`scm-group://${this.resource.id}`);
  }
}

export class SCMResourceFolder extends CompositeTreeNode {
  constructor(
    tree: SCMTreeService,
    parent: CompositeTreeNode | undefined,
    public raw: ISCMTreeNodeDescription<ISCMResource>,
    public readonly resource: ISCMResource,
    id?: number,
  ) {
    super(tree as ITree, parent, undefined, { name: raw.name });
    this.id = id || this.id;
    // 目录节点默认全部展开
    this.isExpanded = true;
  }

  @memoize
  get uri(): URI {
    return new URI(this.raw.resource.sourceUri);
  }

  @memoize
  get tooltip(): string {
    const node = this.resource;

    return path.join(node.resourceGroup.provider.rootUri!.path, this.raw.pathname!);
  }

  /**
   * folder 需要拿到所有的 children 作为参数
   */
  get arguments(): ISCMResource[] {
    return collectSCMResourceDesc(this.raw, []);
  }

  description = '';
}

export class SCMResourceFile extends TreeNode {
  constructor(
    tree: SCMTreeService,
    parent: CompositeTreeNode | undefined,
    public raw: ISCMTreeNodeDescription<ISCMResource>,
    public readonly resource: ISCMResource,
    private readonly isTree?: boolean,
    id?: number,
  ) {
    super(tree as ITree, parent, undefined, { name: raw.pathname });
    this.id = id || this.id;
  }

  @memoize
  get uri(): URI {
    return new URI(this.raw.resource.sourceUri);
  }

  // Tree 模式下则没有 description
  @memoize
  get description(): string {
    if (this.isTree) {
      return '';
    }

    const node = this.resource;
    const filePath = path.parse(node.sourceUri.path);

    return path.relative(node.resourceGroup.provider.rootUri!.path, filePath.dir);
  }

  @memoize
  get tooltip(): string {
    return this.resource.sourceUri.path;
  }
}

export type SCMResourceItem = SCMResourceRoot | SCMResourceGroup | SCMResourceFolder | SCMResourceFile;
export type SCMResourceNotRoot = SCMResourceGroup | SCMResourceFolder | SCMResourceFile;
export type SCMResourceNotFile = SCMResourceRoot | SCMResourceGroup | SCMResourceFolder;
