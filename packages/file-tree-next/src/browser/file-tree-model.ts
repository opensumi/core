import { ITree, TreeModel, IOptionalMetaData, TreeNodeEvent } from '@ali/ide-components';
import { Injectable, Optional} from '@ali/common-di';
import { Directory } from './file-tree-nodes';
import { URI } from '@ali/ide-core-node';
import { FileStat } from '@ali/ide-file-service';

export interface IFileTreeMetaData extends IOptionalMetaData {
  uri: URI;
  filestat?: FileStat;
}

@Injectable()
export class FileTreeModel extends TreeModel {
  constructor(@Optional() tree: ITree, @Optional() optionalMetaData: IFileTreeMetaData) {
    super();
    this.init(tree, optionalMetaData);
  }

  init(tree: ITree, optionalMetaData: IFileTreeMetaData) {
    this.root = new Directory(tree, undefined, optionalMetaData.uri, optionalMetaData.name, optionalMetaData.fiestat);
    // 分支更新时通知树刷新
    this.root.watcher.on(TreeNodeEvent.BranchDidUpdate, this.dispatchChange);
  }
}
