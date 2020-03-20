import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { TreeModel, DecorationsManager, Decoration, IRecycleTreeHandle, NodeType } from '@ali/ide-components';
import { FileTreeService } from '../file-tree.service';
import { FileTreeModel } from '../file-tree-model';
import * as styles from '../file-tree-node.module.less';
import { File, Directory } from '../file-tree-nodes';
import { CorePreferences } from '@ali/ide-core-browser';

export interface IFileTreeHandle extends IRecycleTreeHandle {
  hasDirectFocus: () => boolean;
}

@Injectable()
export class FileTreeModelService {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(FileTreeService)
  private readonly fileTreeService: FileTreeService;

  @Autowired(CorePreferences)
  private readonly corePreferences: CorePreferences;

  private _treeModel: TreeModel;

  private _whenReady: Promise<void>;

  private _decorations: DecorationsManager;
  private _fileTreeHandle: IFileTreeHandle;

  // 装饰器
  private selectedDecoration: Decoration = new Decoration(styles.mod_selected); // 选中态
  private focusedDecoration: Decoration = new Decoration(styles.mod_focused); // 焦点态

  private activeFile: File | Directory;
  private clickTimes: number;
  private clickTimer: any;

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
    this.initDecorations(root);
  }

  initDecorations(root) {
    this._decorations = new DecorationsManager(root as any);
    this._decorations.addDecoration(this.selectedDecoration);
    this._decorations.addDecoration(this.focusedDecoration);
  }

  activeFileDecoration = async (target?: File | Directory) => {
    if (target === this.treeModel.root) {
      // 根节点不能选中
      return ;
    }
    if (this.activeFile !== target) {
      if (this.activeFile) {
        this.focusedDecoration.removeTarget(this.activeFile);
        this.selectedDecoration.removeTarget(this.activeFile);
      }
      if (target) {
        this.selectedDecoration.addTarget(target);
        this.focusedDecoration.addTarget(target);
        this.activeFile = target;
        // 通知视图更新
        this.treeModel.dispatchChange();
      }
    }
    if (this.activeFile) {
      await this.fileTreeHandle.ensureVisible(this.activeFile);
    }
  }

  toggleDirectory = (item: Directory) => {
    if (item.expanded) {
      this.fileTreeHandle.collapseNode(item);
    } else {
      this.fileTreeHandle.expandNode(item);
    }
  }

  removeFileDecoration() {
    this.decorations.removeDecoration(this.selectedDecoration);
    this.decorations.removeDecoration(this.focusedDecoration);
  }

  handleTreeHandler(handle: IFileTreeHandle) {
    this._fileTreeHandle = handle;
  }

  handleItemClick = (item: File | Directory, type: NodeType) => {
    this.clickTimes ++;
    // 单选操作默认先更新选中状态
    if (type === NodeType.CompositeTreeNode || type === NodeType.TreeNode) {
      this.activeFileDecoration(item);
    }
    // 如果为文件夹需展开
    // 如果为文件，则需要打开文件
    if (type === NodeType.CompositeTreeNode) {
      if (this.corePreferences['workbench.list.openMode'] === 'singleClick') {
        this.toggleDirectory(item as Directory);
      }
    } else if (type === NodeType.TreeNode) {
      this.fileTreeService.openFile(item.uri);
    }
    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
    }
    this.clickTimer = setTimeout(() => {
      // 单击事件
      // 200ms内多次点击默认为双击事件
      if (this.clickTimes > 1) {
        if (type === NodeType.TreeNode) {
          this.fileTreeService.openAndFixedFile(item.uri);
        } else {
          if (this.corePreferences['workbench.list.openMode'] === 'doubleClick') {
            this.toggleDirectory(item as Directory);
          }
        }
      }
      this.clickTimes = 0;
    }, 200);
  }

  get fileTreeHandle() {
    return this._fileTreeHandle;
  }

  get decorations() {
    return this._decorations;
  }

  get treeModel() {
    return this._treeModel;
  }
}
