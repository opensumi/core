import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { TreeModel } from '@ali/ide-components';
import { FileTreeService } from '../file-tree.service';
import { FileTreeModel, IFileTreeMetaData } from '../file-tree-model';

@Injectable()
export class FileTreeModelService {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(FileTreeService)
  private readonly fileTreeService: FileTreeService;

  private _treeModel: TreeModel;
  constructor() {
    const { workspaceRoot, workspaceRootFileStat } = this.fileTreeService;
    const fileTreeMetaData: IFileTreeMetaData = {
      uri: workspaceRoot,
      name: workspaceRoot.displayName,
      filestat: workspaceRootFileStat,
    };
    this._treeModel = this.injector.get<any>(FileTreeModel, [this.fileTreeService, fileTreeMetaData]);
  }

  get treeModel() {
    return this._treeModel;
  }
}
