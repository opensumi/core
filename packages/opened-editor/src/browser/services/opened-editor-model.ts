import { Injectable, Optional, Autowired } from '@opensumi/di';
import { TreeModel, TreeNodeEvent, CompositeTreeNode } from '@opensumi/ide-components';
import { ThrottledDelayer, Emitter, Event } from '@opensumi/ide-core-browser';

import { EditorFileGroup } from '../opened-editor-node.define';

import { OpenedEditorDecorationService } from './opened-editor-decoration.service';

@Injectable({ multiple: true })
export class OpenedEditorModel extends TreeModel {
  static DEFAULT_FLUSH_DELAY = 100;

  @Autowired(OpenedEditorDecorationService)
  public readonly decorationService: OpenedEditorDecorationService;

  private flushDispatchChangeDelayer = new ThrottledDelayer<void>(OpenedEditorModel.DEFAULT_FLUSH_DELAY);
  private onWillUpdateEmitter: Emitter<void> = new Emitter();

  constructor(@Optional() root: EditorFileGroup) {
    super();
    this.init(root);
  }

  get onWillUpdate(): Event<void> {
    return this.onWillUpdateEmitter.event;
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
      await this.onWillUpdateEmitter.fireAndAwait();
      this.dispatchChange();
    });
  }
}
