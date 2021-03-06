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

  // ?????????
  private selectedDecoration: Decoration = new Decoration(styles.mod_selected); // ?????????
  private focusedDecoration: Decoration = new Decoration(styles.mod_focused); // ?????????
  private loadingDecoration: Decoration = new Decoration(styles.mod_loading); // ?????????
  private cutDecoration: Decoration = new Decoration(styles.mod_cut); // ?????????
  // ???????????????????????????????????????????????????????????????
  private _focusedFile: File | Directory | undefined;
  // ???????????????????????????????????????
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

  // ???????????????????????????????????????
  get focusedFile() {
    return this._focusedFile;
  }
  // ?????????????????????????????????
  get selectedFiles() {
    return this._selectedFiles;
  }

  async initTreeModel() {
    // ????????????????????????????????????????????????
    const root = (await this.fileTreeDialogService.resolveChildren())[0];
    this._treeModel = this.injector.get<any>(FileTreeModel, [root]);

    this.initDecorations(root);

    this.disposableCollection.push(this._decorations);

    this.disposableCollection.push(
      this.labelService.onDidChange(() => {
        // ???labelService?????????????????????????????????????????????????????????
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
        // ?????????????????????????????????
        if (this.focusedFile) {
          const node = this.treeModel?.root.getTreeNodeByPath(this.focusedFile.path);
          if (node) {
            this.activeFileDecoration(node as File, false);
          }
        } else if (this.selectedFiles.length !== 0) {
          // ???????????????????????????
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

  // ???????????????????????????
  clearFileSelectedDecoration = () => {
    this._selectedFiles.forEach((file) => {
      this.selectedDecoration.removeTarget(file);
    });
    this._selectedFiles = [];
    this.onDidSelectedFileChangeEmitter.fire([]);
  };

  // ??????????????????/??????????????????????????????????????????
  activeFileDecoration = (target: File | Directory, dispatchChange = true) => {
    if (target === this.treeModel.root) {
      // ?????????????????????
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
      // ???????????????????????????
      this.onDidFocusedFileChangeEmitter.fire(target.uri);
      this.onDidSelectedFileChangeEmitter.fire([target.uri]);
      // ??????????????????
      if (dispatchChange) {
        this.treeModel.dispatchChange();
      }
    }
  };

  // ??????????????????/??????????????????????????????????????????
  selectFileDecoration = (target: File | Directory, dispatchChange = true) => {
    if (target === this.treeModel.root) {
      // ?????????????????????
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
      // ???????????????????????????
      this.onDidSelectedFileChangeEmitter.fire([target.uri]);
      // ??????????????????
      if (dispatchChange) {
        this.treeModel.dispatchChange();
      }
    }
  };

  // ?????????????????????????????????????????????????????????
  // removePreFocusedDecoration ??????????????????????????????????????????????????????????????????????????????????????????????????????
  activeFileFocusedDecoration = (target: File | Directory, removePreFocusedDecoration = false) => {
    if (target === this.treeModel.root) {
      // ?????????????????????
      return;
    }

    if (this.focusedFile !== target) {
      if (removePreFocusedDecoration) {
        // ????????????????????????????????????????????????????????????????????????????????????????????????????????????
        if (this.preContextMenuFocusedFile) {
          this.focusedDecoration.removeTarget(this.preContextMenuFocusedFile);
          this.selectedDecoration.removeTarget(this.preContextMenuFocusedFile);
        } else if (this.focusedFile) {
          // ??????????????????????????????????????????
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
        // ????????????????????????
        this.onDidFocusedFileChangeEmitter.fire(target.uri);
        this.onDidSelectedFileChangeEmitter.fire(this._selectedFiles.map((file) => file.uri));
      }
    }
    // ??????????????????
    this.treeModel.dispatchChange();
  };

  // ????????????????????????????????????????????????
  activeFileSelectedDecoration = (target: File | Directory) => {
    if (this._selectedFiles.indexOf(target) > -1) {
      return;
    }
    this._selectedFiles.push(target);
    this.selectedDecoration.addTarget(target);
    // ??????????????????
    this.onDidSelectedFileChangeEmitter.fire(this._selectedFiles.map((file) => file.uri));
    // ??????????????????
    this.treeModel.dispatchChange();
  };

  // ??????????????????????????????
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
    // ??????????????????
    this.onDidSelectedFileChangeEmitter.fire(this._selectedFiles.map((file) => file.uri));
    // ??????????????????
    this.treeModel.dispatchChange();
  };

  // ????????????????????????
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

  handleTreeHandler(handle: IFileTreeHandle) {
    this._fileTreeHandle = handle;
  }

  handleTreeBlur = () => {
    // ??????????????????
    this.enactiveFileDecoration();
  };

  handleTreeFocus = () => {
    // ????????????
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
    // ???????????????????????????????????????????????????????????????????????????
    // ??????????????????????????????
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
    // ???????????????????????????????????????
    if (type === TreeNodeType.CompositeTreeNode || type === TreeNodeType.TreeNode) {
      this.activeFileDecoration(item);
    }
    // ???????????????????????????
    // ???????????????????????????????????????
    if (type === TreeNodeType.CompositeTreeNode) {
      if (this.corePreferences['workbench.list.openMode'] === 'singleClick') {
        this.toggleDirectory(item as Directory);
      }
    }
    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
    }
    this.clickTimer = setTimeout(() => {
      // ????????????
      // 200ms????????????????????????????????????
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
