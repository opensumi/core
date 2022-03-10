import { Injectable, Optional, Autowired } from '@opensumi/di';
import { TreeModel, TreeNodeEvent, CompositeTreeNode } from '@opensumi/ide-components';
import { ThrottledDelayer, Emitter, Event } from '@opensumi/ide-core-browser';

import { SCMTreeDecorationService } from './scm-tree-decoration.service';
import { SCMResourceFolder, SCMResourceRoot } from './scm-tree-node';

@Injectable({ multiple: true })
export class SCMTreeModel extends TreeModel {
  static DEFAULT_FLUSH_DELAY = 100;

  @Autowired(SCMTreeDecorationService)
  public readonly decorationService: SCMTreeDecorationService;

  private onWillUpdateEmitter: Emitter<void> = new Emitter();

  private flushDispatchChangeDelayer = new ThrottledDelayer<void>(SCMTreeModel.DEFAULT_FLUSH_DELAY);

  constructor(@Optional() root: SCMResourceFolder | SCMResourceRoot) {
    super();
    this.init(root);
  }

  get onWillUpdate(): Event<void> {
    return this.onWillUpdateEmitter.event;
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
        await this.onWillUpdateEmitter.fireAndAwait();
        this.dispatchChange();
      });
    });
    // this.root.watcher.on(TreeNodeEvent.BranchDidUpdate, this.dispatchChange);
    // 主题或装饰器更新时，更新树
    this.decorationService.onDidChange(this.dispatchChange);
  }
}
