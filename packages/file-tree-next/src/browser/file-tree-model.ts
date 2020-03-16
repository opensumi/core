import { ITree, TreeModel, IOptionalMetaData, TreeNodeEvent } from '@ali/ide-components';
import { Injectable, Optional, Autowired} from '@ali/common-di';
import { Directory } from './file-tree-nodes';
import { URI } from '@ali/ide-core-node';
import { FileStat } from '@ali/ide-file-service';
import { FileTreeDecorationService } from './services/file-tree-decoration.service';

export interface IFileTreeMetaData extends IOptionalMetaData {
  uri: URI;
  filestat?: FileStat;
}

@Injectable()
export class FileTreeModel extends TreeModel {

  @Autowired(FileTreeDecorationService)
  public readonly decorationService: FileTreeDecorationService;

  constructor(@Optional() tree: ITree, @Optional() optionalMetaData: IFileTreeMetaData) {
    super();
    this.init(tree, optionalMetaData);
  }

  init(tree: ITree, optionalMetaData: IFileTreeMetaData) {
    this.root = new Directory(tree, undefined, optionalMetaData.uri, optionalMetaData.name, optionalMetaData.fiestat);
    // 分支更新时通知树刷新
    this.root.watcher.on(TreeNodeEvent.BranchDidUpdate, this.dispatchChange);
    // 主题或装饰器更新时，更新树
    this.decorationService.onDidChange(this.dispatchChange);
  }
}
