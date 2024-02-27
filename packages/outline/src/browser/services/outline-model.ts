import { Injectable, Optional } from '@opensumi/di';
import { CompositeTreeNode, TreeModel, TreeNodeEvent } from '@opensumi/ide-components';
import { ThrottledDelayer } from '@opensumi/ide-core-browser';

import { OutlineCompositeTreeNode } from '../outline-node.define';

@Injectable({ multiple: true })
export class OutlineTreeModel extends TreeModel {
  static DEFAULT_FLUSH_DELAY = 100;

  private flushDispatchChangeDelayer = new ThrottledDelayer<void>(OutlineTreeModel.DEFAULT_FLUSH_DELAY);

  constructor(@Optional() root: OutlineCompositeTreeNode) {
    super();
    this.init(root);
  }

  init(root: CompositeTreeNode) {
    this.root = root;
    // 分支更新时通知树刷新, 不是立即更新，而是延迟更新，待树稳定后再更新
    // 100ms的延迟并不能保证树稳定，特别是在node_modules展开的情况下
    // 但在普通使用上已经足够可用，即不会有渲染闪烁问题
    this.root.watcher.on(TreeNodeEvent.BranchDidUpdate, () => {
      if (!this.flushDispatchChangeDelayer.isTriggered()) {
        this.flushDispatchChangeDelayer.cancel();
      }
      this.flushDispatchChangeDelayer.trigger(async () => {
        this.dispatchChange();
      });
    });
  }
}
