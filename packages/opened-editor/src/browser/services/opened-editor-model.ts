import { Autowired, Injectable, Optional } from '@opensumi/di';
import { CompositeTreeNode, TreeModel, TreeNodeEvent } from '@opensumi/ide-components';
import { ThrottledDelayer } from '@opensumi/ide-core-browser';

import { EditorFileGroup } from '../opened-editor-node.define';

import { OpenedEditorDecorationService } from './opened-editor-decoration.service';

@Injectable({ multiple: true })
export class OpenedEditorModel extends TreeModel {
  static DEFAULT_FLUSH_DELAY = 100;

  @Autowired(OpenedEditorDecorationService)
  public readonly decorationService: OpenedEditorDecorationService;

  private flushDispatchChangeDelayer = new ThrottledDelayer<void>(OpenedEditorModel.DEFAULT_FLUSH_DELAY);

  constructor(@Optional() root: EditorFileGroup) {
    super();
    this.init(root);
  }

  init(root: CompositeTreeNode) {
    this.root = root;
    // 分支更新时通知树刷新, 不是立即更新，而是延迟更新，待树稳定后再更新
    this.root.watcher.on(TreeNodeEvent.BranchDidUpdate, this.doDispatchChange.bind(this));
    // 主题或装饰器更新时，更新树
    this.decorationService.onDidChange(this.doDispatchChange.bind(this));
  }

  doDispatchChange() {
    if (!this.flushDispatchChangeDelayer.isTriggered()) {
      this.flushDispatchChangeDelayer.cancel();
    }
    this.flushDispatchChangeDelayer.trigger(async () => {
      this.dispatchChange();
    });
  }
}
