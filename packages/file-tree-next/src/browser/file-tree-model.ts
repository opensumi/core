import { Autowired, Injectable, Optional } from '@opensumi/di';
import { IOptionalMetaData, TreeModel, TreeNodeEvent } from '@opensumi/ide-components';
import { ThrottledDelayer, URI } from '@opensumi/ide-core-browser';
import { FileStat } from '@opensumi/ide-file-service';

import { Directory } from '../common/file-tree-node.define';

import { FileTreeDecorationService } from './services/file-tree-decoration.service';

export interface IFileTreeMetaData extends IOptionalMetaData {
  uri: URI;
  filestat?: FileStat;
}

@Injectable({ multiple: true })
export class FileTreeModel extends TreeModel {
  static DEFAULT_FLUSH_DELAY = 100;

  @Autowired(FileTreeDecorationService)
  public readonly decorationService: FileTreeDecorationService;

  private flushDispatchChangeDelayer = new ThrottledDelayer<void>(FileTreeModel.DEFAULT_FLUSH_DELAY);

  constructor(@Optional() root: Directory) {
    super();
    this.init(root);
  }

  init(root: Directory) {
    this.root = root;
    // 分支更新时通知树刷新, 不是立即更新，而是延迟更新，待树稳定后再更新
    // 100ms的延迟并不能保证树稳定，特别是在node_modules展开的情况下
    // 但在普通使用上已经足够可用，即不会有渲染闪烁问题
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
