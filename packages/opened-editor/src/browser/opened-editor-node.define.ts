import { TreeNode, CompositeTreeNode, ITree } from '@opensumi/ide-components';
import { formatLocalize, URI } from '@opensumi/ide-core-browser';
import { IEditorGroup, IResource } from '@opensumi/ide-editor';

import { OpenedEditorService } from './services/opened-editor-tree.service';


export type OpenedEditorData = IEditorGroup | IResource;

export class EditorFileRoot extends CompositeTreeNode {
  static is(node: EditorFileGroup | EditorFileRoot): node is EditorFileRoot {
    return !!node && !node.parent;
  }

  constructor(tree: OpenedEditorService, id?: number) {
    super(tree as ITree, undefined, undefined, undefined, { disableCache: true });
    // 根节点默认展开节点
    this._uid = id || this._uid;
    TreeNode.setTreeNode(this._uid, this.path, this);
  }

  get expanded() {
    return true;
  }

  dispose() {
    super.dispose();
  }
}

// EditorFileGroup 节点不包含父节点, 同时默认为展开状态
export class EditorFileGroup extends CompositeTreeNode {
  static isEditorGroup(data: OpenedEditorData): data is IEditorGroup {
    return typeof (data as any).resources !== 'undefined';
  }

  static is(node: EditorFileGroup | EditorFile): node is EditorFileGroup {
    return !!node && !!(node as EditorFileGroup).group;
  }

  private groupIndex: number;

  constructor(tree: OpenedEditorService, public readonly group: IEditorGroup, parent: EditorFileRoot, id?: number) {
    super(tree as ITree, parent, undefined, undefined, { disableCache: true });
    this.groupIndex = this.group.index;
    this._uid = id || this._uid;
    TreeNode.setTreeNode(this._uid, this.path, this);
    // 根节点默认展开节点
    this.setExpanded(false, true);
  }

  get name() {
    return formatLocalize('opened.editors.group.title', this.groupIndex + 1);
  }

  get tooltip() {
    return this.name;
  }

  dispose() {
    super.dispose();
  }
}

export class EditorFile extends TreeNode {
  constructor(
    tree: OpenedEditorService,
    public readonly resource: IResource,
    public tooltip: string,
    parent: EditorFileGroup | undefined,
    id?: number,
  ) {
    super(tree as ITree, parent, undefined, undefined, { disableCache: true });
    this._uid = id || this._uid;
    TreeNode.setTreeNode(this._uid, this.path, this);
  }

  get name() {
    return this.resource ? this.resource.name : '';
  }

  get uri() {
    return this.resource ? this.resource.uri : new URI();
  }

  dispose() {
    super.dispose();
  }
}
