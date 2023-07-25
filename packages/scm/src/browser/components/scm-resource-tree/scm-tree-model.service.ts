import { observable } from 'mobx';

import { Autowired, Injectable, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { Decoration, DecorationsManager, IRecycleTreeHandle, TreeNodeType } from '@opensumi/ide-components';
import {
  CommandService,
  CorePreferences,
  PreferenceService,
  EDITOR_COMMANDS,
  ILogger,
  CancellationTokenSource,
} from '@opensumi/ide-core-browser';
import { DisposableCollection, Emitter, Event, URI } from '@opensumi/ide-core-browser';
import { ICtxMenuRenderer } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/base';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IIconService, IIconTheme } from '@opensumi/ide-theme';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { ISCMRepository, ISCMResource, scmResourceViewId } from '../../../common';
import { ViewModelContext } from '../../scm-model';

import { SCMTreeDecorationService } from './scm-tree-decoration.service';
import { SCMTreeModel } from './scm-tree-model';
import { SCMResourceFolder, SCMResourceFile, SCMResourceGroup, SCMResourceRoot } from './scm-tree-node';
import styles from './scm-tree-node.module.less';
import { SCMTreeService } from './scm-tree.service';

export interface IEditorTreeHandle extends IRecycleTreeHandle {
  hasDirectFocus: () => boolean;
}

export enum SCMTreeTypes {
  List = 1,
  Tree,
}

const defaultIconThemeDesc = {
  hasFolderIcons: true,
  hasFileIcons: true,
  hidesExplorerArrows: true,
};

type SCMTreeNodeType = SCMResourceGroup | SCMResourceFile | SCMResourceFolder;

@Injectable()
export class SCMTreeModelService {
  @Autowired(LabelService)
  public readonly labelService: LabelService;

  @Autowired(SCMTreeDecorationService)
  public readonly decorationService: SCMTreeDecorationService;

  @Autowired(CommandService)
  public readonly commandService: CommandService;

  @Autowired(IProgressService)
  public readonly progressService: IProgressService;

  @Autowired(IIconService)
  private readonly iconService: IIconService;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(SCMTreeService)
  private readonly scmTreeService: SCMTreeService;

  @Autowired(ViewModelContext)
  private readonly viewModel: ViewModelContext;

  @Autowired(ICtxMenuRenderer)
  private readonly ctxMenuRenderer: ICtxMenuRenderer;

  @Autowired(CorePreferences)
  private readonly corePreferences: CorePreferences;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  private _activeTreeModel: SCMTreeModel;
  private _whenReady: Promise<void>;

  private _activeDecorations: DecorationsManager;
  private _scmTreeHandle: IEditorTreeHandle;

  private refreshCancelToken: CancellationTokenSource | null;

  // 装饰器
  private _selectedDecoration: Decoration;
  private _focusedDecoration: Decoration;
  private _contextMenuDecoration: Decoration;
  // 即使选中态也是焦点态的节点
  private _focusedFile: SCMResourceGroup | SCMResourceFile | undefined;
  // 选中态的节点
  private _selectedFiles: (SCMResourceGroup | SCMResourceFile)[] = [];
  // 右键菜单选择的节点
  private _contextMenuFile: SCMTreeNodeType | undefined;

  private disposableCollection: DisposableCollection = new DisposableCollection();
  private treeModelDisposableCollection: DisposableCollection;

  private onDidRefreshedEmitter: Emitter<void> = new Emitter();
  private onDidTreeModelChangeEmitter: Emitter<SCMTreeModel> = new Emitter();

  private treeModelCache: Map<
    string,
    {
      treeModel: SCMTreeModel;
      decorations: DecorationsManager;
      selectedDecoration: Decoration;
      focusedDecoration: Decoration;
      contextMenuDecoration: Decoration;
    }
  > = new Map();

  constructor() {
    this.showProgress((this._whenReady = this.initTreeModel(this.scmTreeService.isTreeMode)));
    this.disposableCollection.push(
      this.scmTreeService.onDidTreeModeChange((isTreeMode) => {
        // 展示进度条
        this.showProgress((this._whenReady = this.initTreeModel(isTreeMode)));
      }),
    );

    this.disposableCollection.push(
      this.viewModel.onDidSelectedRepoChange((repo: ISCMRepository) => {
        this._whenReady = this.initTreeModel(this.scmTreeService.isTreeMode, repo.provider.rootUri?.toString());
      }),
    );

    const onDidChange = Event.any(
      // 当labelService注册的对应节点图标变化时，通知视图更新
      Event.map(this.labelService.onDidChange, () => {}),
      // 根据 scm list 事件刷新树
      this.viewModel.onDidSCMListChange,
      // 当偏好设置改为压缩目录并且此时为 tree 模式
      Event.map(
        Event.filter(
          this.preferenceService.onPreferenceChanged,
          (e) => e.preferenceName === 'scm.listView.compactFolders' && this.scmTreeService.isTreeMode,
        ),
        () => {},
      ),
    );

    this.disposableCollection.push(
      onDidChange(() => {
        this.refresh();
      }),
    );

    this.setIconThemeDesc(this.iconService.currentTheme || defaultIconThemeDesc);
    this.disposableCollection.push(
      this.iconService.onThemeChange((theme) => {
        this.setIconThemeDesc(theme);
      }),
    );
  }

  @observable.deep
  public iconThemeDesc: Pick<IIconTheme, 'hasFileIcons' | 'hasFolderIcons' | 'hidesExplorerArrows'> =
    defaultIconThemeDesc;

  private setIconThemeDesc(theme: IIconTheme) {
    this.iconThemeDesc = {
      hasFolderIcons: !!theme.hasFolderIcons,
      hasFileIcons: !!theme.hasFileIcons,
      hidesExplorerArrows: !!theme.hidesExplorerArrows,
    };
  }

  private showProgress(promise: Promise<any>) {
    // 展示一个进度条
    this.progressService.withProgress({ location: scmResourceViewId }, () => promise);
  }

  get scmTreeHandle() {
    return this._scmTreeHandle;
  }

  // 右键菜单选中的节点
  get contextMenuFile() {
    return this._contextMenuFile;
  }

  get selectedDecoration() {
    return this._selectedDecoration;
  }

  get focusedDecoration() {
    return this._focusedDecoration;
  }

  get contextMenuDecoration() {
    return this._contextMenuDecoration;
  }

  get decorations() {
    return this._activeDecorations;
  }

  get treeModel() {
    return this._activeTreeModel;
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

  get onDidRefreshed(): Event<void> {
    return this.onDidRefreshedEmitter.event;
  }

  get onDidTreeModelChange() {
    return this.onDidTreeModelChangeEmitter.event;
  }

  public async collapseAll() {
    await this.treeModel.root.collapsedAll();
  }

  private async getCacheKey(type: SCMTreeTypes = SCMTreeTypes.List, workspace?: string) {
    if (!workspace) {
      workspace = (await this.workspaceService.roots)[0]?.uri;
    }
    return `${workspace}_git_${type === SCMTreeTypes.List ? 'list' : 'tree'}`;
  }

  async initTreeModel(isTree?: boolean, workspace?: string) {
    if (this.treeModelDisposableCollection) {
      this.treeModelDisposableCollection.dispose();
    }
    const type = isTree ? SCMTreeTypes.Tree : SCMTreeTypes.List;
    const cacheKey = await this.getCacheKey(type, workspace);
    if (this.treeModelCache.has(cacheKey)) {
      const { treeModel, decorations, selectedDecoration, focusedDecoration, contextMenuDecoration } =
        this.treeModelCache.get(cacheKey)!;
      this._activeTreeModel = treeModel;
      this._activeDecorations = decorations;
      this._selectedDecoration = selectedDecoration;
      this._focusedDecoration = focusedDecoration;
      this._contextMenuDecoration = contextMenuDecoration;
      await this.refresh();
    } else {
      // 根据是否为多工作区创建不同根节点
      const root = (await this.scmTreeService.resolveChildren())[0] as SCMResourceRoot;
      if (!root) {
        return;
      }
      this._activeTreeModel = this.injector.get(SCMTreeModel, [root]);

      this._activeDecorations = this.initDecorations(root);

      this.disposableCollection.push(this._activeDecorations);

      this.treeModelCache.set(cacheKey, {
        treeModel: this._activeTreeModel,
        decorations: this._activeDecorations,
        selectedDecoration: this._selectedDecoration,
        focusedDecoration: this._focusedDecoration,
        contextMenuDecoration: this._contextMenuDecoration,
      });
    }
    this.treeModelDisposableCollection = new DisposableCollection();
    this.onDidTreeModelChangeEmitter.fire(this._activeTreeModel);
  }

  dispose() {
    this.disposableCollection.dispose();
  }

  initDecorations(root: SCMResourceRoot) {
    this._activeDecorations = new DecorationsManager(root);
    this._selectedDecoration = new Decoration(styles.mod_selected); // 选中态
    this._focusedDecoration = new Decoration(styles.mod_focused); // 焦点态
    this._contextMenuDecoration = new Decoration(styles.mod_actived); // 右键态
    this._activeDecorations.addDecoration(this.selectedDecoration);
    this._activeDecorations.addDecoration(this.focusedDecoration);
    this._activeDecorations.addDecoration(this.contextMenuDecoration);
    return this._activeDecorations;
  }

  // 清空所有节点选中态
  clearFileSelectedDecoration = () => {
    this._selectedFiles.forEach((file) => {
      this.selectedDecoration.removeTarget(file);
    });
    this._selectedFiles = [];
  };

  // 清空其他选中/焦点态节点，更新当前焦点节点
  activeFileDecoration = (target: SCMTreeNodeType) => {
    if (this.contextMenuFile) {
      this.contextMenuDecoration.removeTarget(this.contextMenuFile);
      this._contextMenuFile = undefined;
    }
    if (target) {
      if (this.selectedFiles.length > 0) {
        for (const target of this.selectedFiles) {
          this.selectedDecoration.removeTarget(target);
        }
      }
      if (this.focusedFile) {
        this.focusedDecoration.removeTarget(this.focusedFile);
      }
      this.selectedDecoration.addTarget(target);
      this.focusedDecoration.addTarget(target);
      this._focusedFile = target;
      this._selectedFiles = [target];
      // 通知视图更新
      this.treeModel.dispatchChange();
    }
  };

  // 清空其他选中/焦点态节点，更新当前选中节点
  selectFileDecoration = (target: SCMResourceGroup | SCMResourceFile) => {
    if (this.contextMenuFile) {
      this.contextMenuDecoration.removeTarget(this.contextMenuFile);
      this._contextMenuFile = undefined;
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

      // 通知视图更新
      this.treeModel.dispatchChange();
    }
  };

  // 清空其他焦点态节点，更新当前焦点节点，
  // removePreFocusedDecoration 表示更新焦点节点时如果此前已存在焦点节点，之前的节点装饰器将会被移除
  activeFileFocusedDecoration = (target: SCMResourceFile | SCMResourceFolder, removePreFocusedDecoration = false) => {
    if (target === this.treeModel.root) {
      // 根节点不能选中
      return;
    }

    if (this.focusedFile !== target) {
      if (removePreFocusedDecoration) {
        if (this.focusedFile) {
          // 多选情况下第一次切换焦点文件
          this.focusedDecoration.removeTarget(this.focusedFile);
        }
        this._contextMenuFile = target;
      } else if (this.focusedFile) {
        this._contextMenuFile = undefined;
        this.focusedDecoration.removeTarget(this.focusedFile);
      }
      if (target) {
        // 存在多选文件时切换焦点的情况
        if (this._selectedFiles.indexOf(target) < 0) {
          this.selectedDecoration.addTarget(target);
          this._selectedFiles.push(target);
        }
        this.focusedDecoration.addTarget(target);
        this._focusedFile = target;
      }
    }
    // 通知视图更新
    this.treeModel.dispatchChange();
  };

  // 选中当前指定节点，添加装饰器属性
  activeFileSelectedDecoration = (target: SCMResourceGroup | SCMResourceFile) => {
    if (this._selectedFiles.indexOf(target) > -1) {
      return;
    }
    this._selectedFiles.push(target);
    this.selectedDecoration.addTarget(target);
    // 通知视图更新
    this.treeModel.dispatchChange();
  };

  // 判断节点是否选中，进行状态反转
  toggleFileSelectedDecoration = (target: SCMResourceGroup | SCMResourceFile) => {
    const index = this._selectedFiles.indexOf(target);
    if (index > -1) {
      if (this.focusedFile === target) {
        this._focusedDecoration.removeTarget(this.focusedFile);
        this._focusedFile = undefined;
      }
      this._selectedFiles.splice(index, 1);
      this.selectedDecoration.removeTarget(target);
    } else {
      this._selectedFiles.push(target);
      this.selectedDecoration.addTarget(target);
      if (this.focusedFile) {
        this._focusedDecoration.removeTarget(this.focusedFile);
      }
      this._focusedFile = target;
      this.focusedDecoration.addTarget(target);
    }
    // 通知视图更新
    this.treeModel.dispatchChange();
  };

  // 取消选中节点焦点
  private enactiveFileDecoration = () => {
    if (this.focusedFile) {
      this.focusedDecoration.removeTarget(this.focusedFile);
      this._focusedFile = undefined;
    }
    if (this.contextMenuFile) {
      this.contextMenuDecoration.removeTarget(this.contextMenuFile);
    }
    this.treeModel?.dispatchChange();
  };

  // 右键菜单焦点态切换
  activeFileActivedDecoration = (target: SCMTreeNodeType) => {
    if (this.contextMenuFile) {
      this.contextMenuDecoration.removeTarget(this.contextMenuFile);
    }
    if (this.focusedFile) {
      this.focusedDecoration.removeTarget(this.focusedFile);
      this._focusedFile = undefined;
    }
    this.contextMenuDecoration.addTarget(target);
    this._contextMenuFile = target;
    this.treeModel.dispatchChange();
  };

  handleTreeHandler(handle: IEditorTreeHandle) {
    this._scmTreeHandle = handle;
  }

  handleTreeBlur = () => {
    // 清空焦点状态
    this.enactiveFileDecoration();
  };

  private _isMutiSelected = false;
  public handleItemRangeClick = (item: SCMResourceGroup | SCMResourceFile, type: TreeNodeType) => {
    if (!this.focusedFile) {
      this.handleItemClick(item, type);
    } else if (this.focusedFile && this.focusedFile !== item) {
      this._isMutiSelected = true;
      const targetIndex = this.treeModel.root.getIndexAtTreeNode(item);
      const preFocusedFileIndex = this.treeModel.root.getIndexAtTreeNode(this.focusedFile);
      if (preFocusedFileIndex > targetIndex) {
        this.activeFileDecorationByRange(targetIndex, preFocusedFileIndex, targetIndex);
      } else if (preFocusedFileIndex < targetIndex) {
        this.activeFileDecorationByRange(preFocusedFileIndex, targetIndex, targetIndex);
      }
    }
  };

  handleItemToggleClick = (item: SCMTreeNodeType, type: TreeNodeType) => {
    this._isMutiSelected = true;
    if (type !== TreeNodeType.CompositeTreeNode && type !== TreeNodeType.TreeNode) {
      return;
    }

    this.toggleFileSelectedDecoration(item);
  };

  public handleContextMenu = (
    event: React.MouseEvent,
    item: SCMResourceGroup | SCMResourceFile | SCMResourceFolder,
    type: TreeNodeType,
  ) => {
    const { x, y } = event.nativeEvent;
    if (!item) {
      return;
    }

    const group = SCMResourceGroup.is(item) ? item.resource : item.resource.resourceGroup;
    const repoMenus = this.viewModel.menus.getRepositoryMenus(group.provider);
    if (!repoMenus) {
      return;
    }

    if (item) {
      this.activeFileActivedDecoration(item);
    } else {
      this.enactiveFileDecoration();
    }

    let args;
    if (SCMResourceFolder.is(item)) {
      // args 应为目录下所有的子节点
      args = (item as SCMResourceFolder).arguments;
    } else {
      // 处理多选/单选时的参数问题
      args = this._isMutiSelected
        ? this._getSelectedFiles().map((file) => file.resource.toJSON())
        : [item.resource.toJSON()];
    }

    if (type === TreeNodeType.TreeNode) {
      const scmResource = item.resource as ISCMResource;
      this.ctxMenuRenderer.show({
        anchor: { x, y },
        menuNodes: repoMenus.getResourceMenu(scmResource).getGroupedMenuNodes()[1],
        args,
      });
    } else if (SCMResourceGroup.is(item)) {
      // SCMResourceGroup
      this.ctxMenuRenderer.show({
        anchor: { x, y },
        menuNodes: repoMenus.getResourceGroupMenu(group).getGroupedMenuNodes()[1],
        args,
      });
    } else {
      // SCMResourceFolder
      this.ctxMenuRenderer.show({
        anchor: { x, y },
        menuNodes: repoMenus.getResourceFolderMenu(group).getGroupedMenuNodes()[1],
        args,
      });
    }
  };

  private _getSelectedFiles() {
    return this._selectedFiles.filter((r) => !!r && !SCMResourceGroup.is(r));
  }

  // 选中范围内的所有节点
  private activeFileDecorationByRange = (begin: number, end: number, focused: number) => {
    this.clearFileSelectedDecoration();
    for (const target of this.focusedDecoration.appliedTargets.keys()) {
      // 清理多余的焦点状态
      this.focusedDecoration.removeTarget(target);
    }
    for (; begin <= end; begin++) {
      const file = this.treeModel.root.getTreeNodeAtIndex(begin);
      if (file) {
        if (begin === focused) {
          // 参考 VSCode 的多选操作，实际上进行 Range 选择时焦点文件仍然为开始时点击的文件
          // 故这里只需要更新 decoration
          this.focusedDecoration.addTarget(file);
        } else if (this.focusedDecoration.hasTarget(file)) {
          this.focusedDecoration.removeTarget(file);
        }
        this._selectedFiles.push(file as SCMResourceFile);
        this.selectedDecoration.addTarget(file);
      }
    }
    // 通知视图更新
    this.treeModel.dispatchChange();
  };

  public handleItemDoubleClick = (item: SCMResourceGroup | SCMResourceFile, type: TreeNodeType) => {
    if (this.listOpenMode === 'doubleClick') {
      if (type === TreeNodeType.TreeNode) {
        this.openFile(item as SCMResourceFile);
      } else {
        this.toggleDirectory(item as SCMResourceGroup);
      }
    }

    if (type === TreeNodeType.TreeNode) {
      // 双击 pin 住当前文件对应的 editor
      const { currentEditorGroup, currentEditor } = this.workbenchEditorService;
      if (currentEditorGroup && currentEditor && currentEditor.currentUri) {
        // uri 一致的情况下将当前 editor pin 住
        if (URI.from((item.resource as ISCMResource).sourceUri).isEqual(currentEditor.currentUri)) {
          currentEditorGroup.pin(currentEditor.currentUri);
        }
      }
    }
  };

  private get listOpenMode() {
    return this.corePreferences['workbench.list.openMode'];
  }

  public handleItemClick = (item: SCMResourceGroup | SCMResourceFile, type: TreeNodeType) => {
    this._isMutiSelected = false;

    // 单选操作默认先更新选中状态
    this.activeFileDecoration(item);

    // 如果为文件夹需展开
    // 如果为文件，则需要打开文件
    if (this.listOpenMode === 'singleClick') {
      if (type === TreeNodeType.TreeNode) {
        this.openFile(item as SCMResourceFile);
      } else {
        this.toggleDirectory(item as SCMResourceGroup);
      }
    }
  };

  private openFile = (item: SCMResourceFile) => {
    const openFileItem = item as SCMResourceFile;
    const commandID = openFileItem.resource.command?.id;
    if (
      commandID === EDITOR_COMMANDS.API_OPEN_EDITOR_COMMAND_ID ||
      commandID === EDITOR_COMMANDS.API_OPEN_DIFF_EDITOR_COMMAND_ID
    ) {
      this.commandService
        .executeCommand(commandID, ...(openFileItem.resource.command?.arguments || []))
        .catch((err) => this.logger.error('Failed to execute command:', err, commandID));
    } else {
      const scmResource = item.resource as ISCMResource;
      scmResource.open(true /* preverseFocus 应该从 editorOptions 中取 */);
    }
  };

  public toggleDirectory = (item: SCMResourceGroup | SCMResourceFolder) => {
    if (item.expanded) {
      this.scmTreeHandle.collapseNode(item);
    } else {
      this.scmTreeHandle.expandNode(item);
    }
  };

  /**
   * 刷新指定下的所有子节点
   * 备注: 由于 SCM 默认都是 List，Tree 只是转出来的，每次都要重新触发计算
   */
  async refresh(node: SCMResourceFolder = this.treeModel?.root as SCMResourceFolder) {
    if (!node) {
      return;
    }
    if (this.refreshCancelToken && !this.refreshCancelToken.token.isCancellationRequested) {
      this.refreshCancelToken.cancel();
    }
    this.refreshCancelToken = new CancellationTokenSource();
    await node.refresh(this.refreshCancelToken);
    this.refreshCancelToken = null;
  }
}
