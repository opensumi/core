import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { TreeModel } from '@ali/ide-components';
import { FileTreeService } from '../file-tree.service';
import { FileTreeModel } from '../file-tree-model';

@Injectable()
export class FileTreeModelService {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(FileTreeService)
  private readonly fileTreeService: FileTreeService;

  private _treeModel: TreeModel;

  private _whenReady: Promise<void>;

  constructor() {
    this._whenReady = this.initTreeModel();
  }

  get whenReady() {
    return this._whenReady;
  }

  async initTreeModel() {
    // 根据是否为多工作区创建不同根节点
    const root = await this.fileTreeService.resolveChildren();
    this._treeModel = this.injector.get<any>(FileTreeModel, [root]);
  }

  get treeModel() {
    return this._treeModel;
  }
}
