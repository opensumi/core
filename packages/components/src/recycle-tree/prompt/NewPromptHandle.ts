import { PromptHandle } from './PromptHandle';
import { TreeNode, CompositeTreeNode } from '../tree';
import { NodeType } from '../TreeNodeRendererWrap';

export class NewPromptHandle extends PromptHandle {
  private _id: number = TreeNode.nextId();
  constructor(public readonly type: NodeType, public readonly parent: CompositeTreeNode) {
    super();
  }

  get id(): number {
    return this._id;
  }

  get depth() {
    return this.parent.depth + 1;
  }
}
