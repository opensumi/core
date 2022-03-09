import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  DecorationsManager,
  Decoration,
  IRecycleTreeHandle,
  TreeNodeType,
  PromptValidateMessage,
  TreeNodeEvent,
  Tree,
} from '@opensumi/ide-components';
import { URI, DisposableCollection, Emitter, CorePreferences, Event } from '@opensumi/ide-core-browser';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';

import { PasteTypes, IFileDialogTreeService, IFileDialogModel } from '../../common';
import { Directory, File } from '../../common/file-tree-node.define';
import { FileTreeModel } from '../file-tree-model';
import styles from '../file-tree-node.module.less';

import { FileTreeDialogService } from './file-dialog.service';

export interface IParseStore {
  files: (File | Directory)[];
  type: PasteTypes;
}

export interface IFileTreeHandle extends IRecycleTreeHandle {
  hasDirectFocus: () => boolean;
}

export interface FileTreeValidateMessage extends PromptValidateMessage {
  value: string;
}

@Injectable()
export class FileTreeDialogModel implements IFileDialogModel {
  static FILE_TREE_SNAPSHOT_KEY = 'FILE_TREE_SNAPSHOT';
  static DEFAULT_LOCATION_FLUSH_DELAY = 500;

  static createContainer(injector: Injector, tree: Tree): Injector {
    const child = injector.createChild([
      {
        token: IFileDialogTreeService,
        useValue: tree,
      },
      {
        token: IFileDialogModel,
        useClass: FileTreeDialogModel,
      },
    ]);
    return child;
  }

  static createModel(injector: Injector, tree: Tree): FileTreeDialogModel {
    return FileTreeDialogModel.createContainer(injector, tree).get(IFileDialogModel);
  }

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(IFileDialogTreeService)
  private readonly fileTreeDialogService: FileTreeDialogService;

  @Autowired(LabelService)
  public readonly labelService: LabelService;

  @Autowired(CorePreferences)
  private readonly corePreferences: CorePreferences;

  private _treeModel: FileTreeModel;

  private _whenReady: Promise<void>;

  private _decorations: DecorationsManager;
  private _fileTreeHandle: IFileTreeHandle;

  // 装饰器
  private selectedDecoration: Decoration = new Decoration(styles.mod_selected); // 选中态
  private focusedDecoration: Decoration = new Decoration(styles.mod_focused); // 焦点态
  private loadingDecoration: Decoration = new Decoration(styles.mod_loading); // 焦点态
  private cutDecoration: Decoration = new Decoration(styles.mod_cut); // 焦点态
  // 即使选中态也是焦点态的节点，全局仅会有一个
  private _focusedFile: File | Directory | undefined;
  // 选中态的节点，会可能有多个
  private _selectedFiles: (File | Directory)[] = [];
  private clickTimes: number;
  private clickTimer: any;

  private preContextMenuFocusedFile: File | Directory | null;

  private disposableCollection: DisposableCollection = new DisposableCollection();

  private onDidFocusedFileChangeEmitter: Emitter<URI | void> = new Emitter();
  private onDidSelectedFileChangeEmitter: Emitter<URI[]> = new Emitter();

  constructor() {
    this._whenReady = this.initTreeModel();
  }

  get onDidFocusedFileChange(): Event<URI | void> {
    return this.onDidFocusedFileChangeEmitter.event;
  }

  get onDidSelectedFileChange(): Event<URI[]> {
    return this.onDidSelectedFileChangeEmitter.event;
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

  get whenReady() {
    return this._whenReady;
  }

  // 既是选中态，也是焦点态节点
  get focusedFile() {
    return this._focusedFile;
  }
  // 是选中态，非焦点态节点
  get selectedFiles() {
    return this._selectedFiles;
  }

  async initTreeModel() {
    // 根据是否为多工作区创建不同根节点
    const root = (await this.fileTreeDialogService.resolveChildren())[0];
    this._treeModel = this.injector.get<any>(FileTreeModel, [root]);

    this.initDecorations(root);

    this.disposableCollection.push(this._decorations);

    this.disposableCollection.push(
      this.labelService.onDidChange(() => {
        // 当labelService注册的对应节点图标变化时，通知视图更新
        this.treeModel.dispatchChange();
      }),
    );
    this.disposableCollection.push(
      this.treeModel.root.watcher.on(TreeNodeEvent.WillResolveChildren, (target) => {
        this.loadingDecoration.addTarget(target);
      }),
    );
    this.disposableCollection.push(
      this.treeModel.root.watcher.on(TreeNodeEvent.DidResolveChildren, (target) => {
        this.loadingDecoration.removeTarget(target);
      }),
    );
    this.disposableCollection.push(
      this.treeModel!.onWillUpdate(() => {
        // 更新树前更新下选中节点
        if (this.focusedFile) {
          const node = this.treeModel?.root.getTreeNodeByPath(this.focusedFile.path);
          if (node) {
            this.activeFileDecoration(node as File, false);
          }
        } else if (this.selectedFiles.length !== 0) {
          // 仅处理一下单选情况
          const node = this.treeModel?.root.getTreeNodeByPath(this.selectedFiles[0].path);
          if (node) {
            this.selectFileDecoration(node as File, false);
          }
        }
      }),
    );
  }

  async updateTreeModel(path: string) {
    const children = await this.fileTreeDialogService.resolveRoot(path);
    if (children && children.length > 0) {
      const root = children[0];
      this._treeModel = this.injector.get<any>(FileTreeModel, [root]);
      this.clearFileSelectedDecoration();
      this.initDecorations(root);
    }
  }

  initDecorations(root) {
    if (this._decorations) {
      this._decorations.dispose();
    }
    this._decorations = new DecorationsManager(root as any);
    this._decorations.addDecoration(this.selectedDecoration);
    this._decorations.addDecoration(this.focusedDecoration);
    this._decorations.addDecoration(this.cutDecoration);
    this._decorations.addDecoration(this.loadingDecoration);
  }

  // 清空所有节点选中态
  clearFileSelectedDecoration = () => {
    this._selectedFiles.forEach((file) => {
      this.selectedDecoration.removeTarget(file);
    });
    this._selectedFiles = [];
    this.onDidSelectedFileChangeEmitter.fire([]);
  };

  // 清空其他选中/焦点态节点，更新当前焦点节点
  activeFileDecoration = (target: File | Directory, dispatchChange = true) => {
    if (target === this.treeModel.root) {
      // 根节点不能选中
      return;
    }

    if (this.preContextMenuFocusedFile) {
      this.focusedDecoration.removeTarget(this.preContextMenuFocusedFile);
      this.selectedDecoration.removeTarget(this.preContextMenuFocusedFile);
      this.preContextMenuFocusedFile = null;
    }
    if (target) {
      if (this.selectedFiles.length > 0) {
        this.selectedFiles.forEach((file) => {
          this.selectedDecoration.removeTarget(file);
        });
      }
      if (this.focusedFile) {
        this.focusedDecoration.removeTarget(this.focusedFile);
      }
      this.selectedDecoration.addTarget(target);
      this.focusedDecoration.addTarget(target);
      this._focusedFile = target;
      this._selectedFiles = [target];
      // 选中及焦点文件变化
      this.onDidFocusedFileChangeEmitter.fire(target.uri);
      this.onDidSelectedFileChangeEmitter.fire([target.uri]);
      // 通知视图更新
      if (dispatchChange) {
        this.treeModel.dispatchChange();
      }
    }
  };

  // 清空其他选中/焦点态节点，更新当前选中节点
  selectFileDecoration = (target: File | Directory, dispatchChange = true) => {
    if (target === this.treeModel.root) {
      // 根节点不能选中
      return;
    }

    if (this.preContextMenuFocusedFile) {
      this.focusedDecoration.removeTarget(this.preContextMenuFocusedFile);
      this.selectedDecoration.removeTarget(this.preContextMenuFocusedFile);
      this.preContextMenuFocusedFile = null;
    }
    if (target) {
      if (this.selectedFiles.length > 0) {
        this.selectedFiles.forEach((file) => {
          this.selectedDecoration.removeTarget(file);
        });
      }
      if (this.focusedFile) {
        this.focusedDecoration.removeTarget(this.focusedFile);
      }
      this.selectedDecoration.addTarget(target);
      this._selectedFiles = [target];
      // 选中及焦点文件变化
      this.onDidSelectedFileChangeEmitter.fire([target.uri]);
      // 通知视图更新
      if (dispatchChange) {
        this.treeModel.dispatchChange();
      }
    }
  };

  // 清空其他焦点态节点，更新当前焦点节点，
  // removePreFocusedDecoration 表示更新焦点节点时如果此前已存在焦点节点，之前的节点装饰器将会被移除
  activeFileFocusedDecoration = (target: File | Directory, removePreFocusedDecoration = false) => {
    if (target === this.treeModel.root) {
      // 根节点不能选中
      return;
    }

    if (this.focusedFile !== target) {
      if (removePreFocusedDecoration) {
        // 当存在上一次右键菜单激活的文件时，需要把焦点态的文件节点的装饰器全部移除
        if (this.preContextMenuFocusedFile) {
          this.focusedDecoration.removeTarget(this.preContextMenuFocusedFile);
          this.selectedDecoration.removeTarget(this.preContextMenuFocusedFile);
        } else if (this.focusedFile) {
          // 多选情况下第一次切换焦点文件
          this.focusedDecoration.removeTarget(this.focusedFile);
        }
        this.preContextMenuFocusedFile = target;
      } else if (this.focusedFile) {
        this.preContextMenuFocusedFile = null;
        this.focusedDecoration.removeTarget(this.focusedFile);
      }
      if (target) {
        this.selectedDecoration.addTarget(target);
        this.focusedDecoration.addTarget(target);
        this._focusedFile = target;
        this._selectedFiles.push(target);
        // 事件通知状态变化
        this.onDidFocusedFileChangeEmitter.fire(target.uri);
        this.onDidSelectedFileChangeEmitter.fire(this._selectedFiles.map((file) => file.uri));
      }
    }
    // 通知视图更新
    this.treeModel.dispatchChange();
  };

  // 选中当前指定节点，添加装饰器属性
  activeFileSelectedDecoration = (target: File | Directory) => {
    if (this._selectedFiles.indexOf(target) > -1) {
      return;
    }
    this._selectedFiles.push(target);
    this.selectedDecoration.addTarget(target);
    // 选中状态变化
    this.onDidSelectedFileChangeEmitter.fire(this._selectedFiles.map((file) => file.uri));
    // 通知视图更新
    this.treeModel.dispatchChange();
  };

  // 选中范围内的所有节点
  activeFileDecorationByRange = (begin: number, end: number) => {
    this.clearFileSelectedDecoration();
    this.preContextMenuFocusedFile = null;
    for (; begin <= end; begin++) {
      const file = this.treeModel.root.getTreeNodeAtIndex(begin);
      if (file) {
        this._selectedFiles.push(file as File);
        this.selectedDecoration.addTarget(file);
      }
    }
    // 选中状态变化
    this.onDidSelectedFileChangeEmitter.fire(this._selectedFiles.map((file) => file.uri));
    // 通知视图更新
    this.treeModel.dispatchChange();
  };

  // 取消选中节点焦点
  enactiveFileDecoration = () => {
    if (this.focusedFile) {
      this.focusedDecoration.removeTarget(this.focusedFile);
      this.onDidFocusedFileChangeEmitter.fire();
      this.treeModel.dispatchChange();
    }
    this._focusedFile = undefined;
  };

  toggleDirectory = async (item: Directory) => {
    if (item.expanded) {
      this.fileTreeHandle.collapseNode(item);
    } else {
      this.fileTreeHandle.expandNode(item);
    }
  };

  removeFileDecoration() {
    this.decorations.removeDecoration(this.selectedDecoration);
    this.decorations.removeDecoration(this.focusedDecoration);
  }

  handleTreeHandler(handle: IFileTreeHandle) {
    this._fileTreeHandle = handle;
  }

  handleTreeBlur = () => {
    // 清空焦点状态
    this.enactiveFileDecoration();
  };

  handleTreeFocus = () => {
    // 激活面板
  };

  handleItemRangeClick = (item: File | Directory, type: TreeNodeType) => {
    if (!this.focusedFile) {
      this.handleItemClick(item, type);
    } else if (this.focusedFile && this.focusedFile !== item) {
      const targetIndex = this.treeModel.root.getIndexAtTreeNode(item);
      const preFocusedFileIndex = this.treeModel.root.getIndexAtTreeNode(this.focusedFile);
      if (preFocusedFileIndex > targetIndex) {
        this.activeFileDecorationByRange(targetIndex, preFocusedFileIndex);
      } else if (preFocusedFileIndex < targetIndex) {
        this.activeFileDecorationByRange(preFocusedFileIndex, targetIndex);
      }
    }
  };

  handleItemToggleClick = (item: File | Directory, type: TreeNodeType) => {
    if (type !== TreeNodeType.CompositeTreeNode && type !== TreeNodeType.TreeNode) {
      return;
    }
    // 选中的节点不是选中状态时，默认先更新节点为选中状态
    // 后续点击切换焦点状态
    if (this.selectedFiles.indexOf(item) > -1) {
      if (this.focusedFile === item) {
        this.enactiveFileDecoration();
      } else {
        this.activeFileFocusedDecoration(item);
      }
    } else {
      this.activeFileSelectedDecoration(item);
    }
  };

  handleItemClick = (item: File | Directory, type: TreeNodeType) => {
    this.clickTimes++;
    // 单选操作默认先更新选中状态
    if (type === TreeNodeType.CompositeTreeNode || type === TreeNodeType.TreeNode) {
      this.activeFileDecoration(item);
    }
    // 如果为文件夹需展开
    // 如果为文件，则需要打开文件
    if (type === TreeNodeType.CompositeTreeNode) {
      if (this.corePreferences['workbench.list.openMode'] === 'singleClick') {
        this.toggleDirectory(item as Directory);
      }
    }
    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
    }
    this.clickTimer = setTimeout(() => {
      // 单击事件
      // 200ms内多次点击默认为双击事件
      if (this.clickTimes > 1) {
        if (type !== TreeNodeType.TreeNode) {
          if (this.corePreferences['workbench.list.openMode'] === 'doubleClick') {
            this.toggleDirectory(item as Directory);
          }
        }
      }
      this.clickTimes = 0;
    }, 200);
  };

  getDirectoryList = () => this.fileTreeDialogService.getDirectoryList();

  dispose() {
    this.disposableCollection.dispose();
  }
}
