import { Autowired, Injectable, Optional } from '@opensumi/di';
import { CompositeTreeNode, TreeModel, TreeNodeEvent } from '@opensumi/ide-components';

import { SCMTreeDecorationService } from './scm-tree-decoration.service';
import { SCMResourceFolder, SCMResourceRoot } from './scm-tree-node';

@Injectable({ multiple: true })
export class SCMTreeModel extends TreeModel {
  @Autowired(SCMTreeDecorationService)
  public readonly decorationService: SCMTreeDecorationService;

  constructor(@Optional() root: SCMResourceFolder | SCMResourceRoot) {
    super();
    this.init(root);
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
