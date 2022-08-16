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
    this.root.watcher.on(TreeNodeEvent.BranchDidUpdate, () => {
      this.dispatchChange();
    });
    // 主题或装饰器更新时，更新树
    this.decorationService.onDidChange(this.dispatchChange);
  }
}
