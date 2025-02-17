import { CompositeTreeNode, ITree, TreeNode } from '@opensumi/ide-components';
import { URI, formatLocalize } from '@opensumi/ide-core-browser';
import { IEditorGroup, IResource } from '@opensumi/ide-editor';

import { OpenedEditorService } from './services/opened-editor-tree.service';

export type OpenedEditorData = IEditorGroup | IResource;

export class EditorFileRoot extends CompositeTreeNode {
  static is(node: EditorFileGroup | EditorFileRoot): node is EditorFileRoot {
    return !!node && !node.parent;
  }

  constructor(tree: OpenedEditorService) {
    super(tree as ITree, undefined);
  }

  get expanded() {
    return true;
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

  constructor(tree: OpenedEditorService, public readonly group: IEditorGroup, parent: EditorFileRoot) {
    super(tree as ITree, parent);
    this.groupIndex = this.group.index;
  }

  get expanded() {
    return true;
  }

  get name() {
    return formatLocalize('opened.editors.group.title', this.groupIndex + 1);
  }

  get displayName() {
    return this.name;
  }

  get tooltip() {
    return this.name;
  }

  dispose() {
    super.dispose();
  }
}

export class EditorFile extends TreeNode {
  public static is(node: any): node is EditorFile {
    return TreeNode.is(node) && 'uri' in node;
  }

  constructor(
    tree: OpenedEditorService,
    public readonly resource: IResource,
    public tooltip: string,
    public dirty: boolean = false,
    parent: EditorFileGroup | undefined,
  ) {
    super(tree as ITree, parent, undefined, { name: `${resource.uri.codeUri.fsPath.toString()}` });
  }

  get displayName() {
    return this.resource ? this.resource.name : '';
  }

  get uri() {
    return this.resource ? this.resource.uri : new URI();
  }
}
