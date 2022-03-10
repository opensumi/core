import { TreeNode, CompositeTreeNode, ITree } from '@opensumi/ide-components';
import { URI, memoize } from '@opensumi/ide-core-browser';
import * as paths from '@opensumi/ide-core-common/lib/path';

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

  private _whenReady: Promise<void>;

  constructor(
    tree: SCMTreeService,
    parent: CompositeTreeNode | undefined,
    public raw: ISCMTreeNodeDescription<ISCMResourceGroup>,
    public readonly resource: ISCMResourceGroup,
    id?: number,
  ) {
    super(tree as ITree, parent, undefined, { name: resource.label }, { disableCache: true });
    this._uid = id || this._uid;
    TreeNode.setTreeNode(this._uid, this.path, this);
    // 目录节点默认全部展开
    this._whenReady = this.setExpanded(false, true);
  }

  get whenReady() {
    return this._whenReady;
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
  private _whenReady: Promise<void>;

  constructor(
    tree: SCMTreeService,
    parent: CompositeTreeNode | undefined,
    public raw: ISCMTreeNodeDescription<ISCMResource>,
    public readonly resource: ISCMResource,
    id?: number,
  ) {
    super(tree as ITree, parent, undefined, { name: raw.name }, { disableCache: true });
    this._uid = id || this._uid;
    TreeNode.setTreeNode(this._uid, this.path, this);
    // 目录节点默认全部展开
    this._whenReady = this.setExpanded(false, true);
  }

  get whenReady() {
    return this._whenReady;
  }

  @memoize
  get uri(): URI {
    return new URI(this.raw.pathname);
  }

  @memoize
  get tooltip(): string {
    const node = this.resource;

    return paths.join(node.resourceGroup.provider.rootUri!.path, this.raw.pathname!);
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
    super(tree as ITree, parent, undefined, { name: raw.pathname }, { disableCache: true });
    this._uid = id || this._uid;
    TreeNode.setTreeNode(this._uid, this.path, this);
  }

  @memoize
  get uri(): URI {
    return new URI(this.raw.pathname);
  }

  // Tree 模式下则没有 description
  @memoize
  get description(): string {
    if (this.isTree) {
      return '';
    }

    const node = this.resource;
    const filePath = paths.parse(node.sourceUri.path);

    return paths.relative(node.resourceGroup.provider.rootUri!.path, filePath.dir);
  }

  @memoize
  get tooltip(): string {
    return this.resource.sourceUri.path;
  }
}

export type SCMResourceItem = SCMResourceRoot | SCMResourceGroup | SCMResourceFolder | SCMResourceFile;
export type SCMResourceNotRoot = SCMResourceGroup | SCMResourceFolder | SCMResourceFile;
export type SCMResourceNotFile = SCMResourceRoot | SCMResourceGroup | SCMResourceFolder;
