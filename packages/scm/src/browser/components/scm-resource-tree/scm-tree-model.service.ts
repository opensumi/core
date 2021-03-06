import { observable } from 'mobx';

import { Autowired, Injectable, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { Decoration, DecorationsManager, IRecycleTreeHandle, TreeNodeType, WatchEvent } from '@opensumi/ide-components';
import {
  CommandService,
  CorePreferences,
  PreferenceService,
  EDITOR_COMMANDS,
  ILogger,
  pSeries,
} from '@opensumi/ide-core-browser';
import { path, Deferred, DisposableCollection, Emitter, Event, URI } from '@opensumi/ide-core-browser';
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
import {
  SCMResourceFolder,
  SCMResourceFile,
  SCMResourceGroup,
  SCMResourceRoot,
  SCMResourceNotRoot,
} from './scm-tree-node';
import styles from './scm-tree-node.module.less';
import { SCMTreeService } from './scm-tree.service';

const { Path } = path;

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

  public flushEventQueueDeferred: Deferred<void> | null;
  private _changeEventDispatchQueue: string[] = [];

  // ?????????
  private _selectedDecoration: Decoration = new Decoration(styles.mod_selected); // ?????????
  private _focusedDecoration: Decoration = new Decoration(styles.mod_focused); // ?????????
  private _contextMenuDecoration: Decoration = new Decoration(styles.mod_actived); // ?????????????????????
  // ???????????????????????????????????????
  private _focusedFile: SCMResourceGroup | SCMResourceFile | undefined;
  // ??????????????????
  private _selectedFiles: (SCMResourceGroup | SCMResourceFile)[] = [];
  // ???????????????????????????
  private _contextMenuFile: SCMResourceGroup | SCMResourceFile | SCMResourceFolder | undefined;

  private disposableCollection: DisposableCollection = new DisposableCollection();

  private onDidRefreshedEmitter: Emitter<void> = new Emitter();
  private onDidTreeModelChangeEmitter: Emitter<SCMTreeModel> = new Emitter();

  private treeModelCache: Map<
    string,
    {
      treeModel: SCMTreeModel;
      decorations: DecorationsManager;
      selectedDecoration: Decoration;
      focusedDecoration: Decoration;
    }
  > = new Map();

  constructor() {
    this.showProgress((this._whenReady = this.initTreeModel(this.scmTreeService.isTreeMode)));
    this.disposableCollection.push(
      this.scmTreeService.onDidTreeModeChange((isTreeMode) => {
        // ???????????????
        this.showProgress((this._whenReady = this.initTreeModel(isTreeMode)));
      }),
    );

    this.disposableCollection.push(
      this.viewModel.onDidSelectedRepoChange((repo: ISCMRepository) => {
        this.initTreeModel(this.scmTreeService.isTreeMode, repo.provider.rootUri?.toString());
      }),
    );

    const onDidChange = Event.any(
      // ???labelService?????????????????????????????????????????????????????????
      Event.map(this.labelService.onDidChange, () => {}),
      // ?????? scm list ???????????????
      this.viewModel.onDidSCMListChange,
      // ?????? list/tree ?????????????????????
      Event.map(this.onDidTreeModelChange, () => {}),
      // ???????????????????????????????????????????????? tree ??????
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
    // ?????????????????????
    this.progressService.withProgress({ location: scmResourceViewId }, () => promise);
  }

  get flushEventQueuePromise() {
    return this.flushEventQueueDeferred && this.flushEventQueueDeferred.promise;
  }

  get scmTreeHandle() {
    return this._scmTreeHandle;
  }

  // ???????????????????????????
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

  // ???????????????????????????????????????
  get focusedFile() {
    return this._focusedFile;
  }
  // ?????????????????????????????????
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
    const type = isTree ? SCMTreeTypes.Tree : SCMTreeTypes.List;
    const preType = !isTree ? SCMTreeTypes.Tree : SCMTreeTypes.List;
    const cacheKey = await this.getCacheKey(type, workspace);
    if (this.treeModelCache.has(cacheKey)) {
      const { treeModel, decorations, selectedDecoration, focusedDecoration } = this.treeModelCache.get(cacheKey)!;
      this._activeTreeModel = treeModel;
      this._activeDecorations = decorations;
      this._selectedDecoration = selectedDecoration;
      this._focusedDecoration = focusedDecoration;

      await this.persistFileSelection(preType);
    } else {
      // ????????????????????????????????????????????????
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
      });

      // ?????????????????????decoration???????????????length?????????1???
      this.treeModel.onWillUpdate(async () => {
        await this.persistFileSelection(preType);
      });
    }

    this.onDidTreeModelChangeEmitter.fire(this._activeTreeModel);
  }

  dispose() {
    this.disposableCollection.dispose();
  }

  initDecorations(root: SCMResourceRoot) {
    this._activeDecorations = new DecorationsManager(root);
    this._selectedDecoration = new Decoration(styles.mod_selected); // ?????????
    this._focusedDecoration = new Decoration(styles.mod_focused); // ?????????
    this._activeDecorations.addDecoration(this.selectedDecoration);
    this._activeDecorations.addDecoration(this.focusedDecoration);
    this._activeDecorations.addDecoration(this.contextMenuDecoration);
    return this._activeDecorations;
  }

  // ???????????????????????????
  clearFileSelectedDecoration = () => {
    this._selectedFiles.forEach((file) => {
      this.selectedDecoration.removeTarget(file);
    });
    this._selectedFiles = [];
  };

  // ??????????????????/??????????????????????????????????????????
  activeFileDecoration = (
    targetFiles: Array<SCMResourceGroup | SCMResourceFile | SCMResourceFolder>,
    focusFile?: SCMResourceGroup | SCMResourceFile | SCMResourceFolder,
  ) => {
    if (this.contextMenuFile) {
      this.contextMenuDecoration.removeTarget(this.contextMenuFile);
      this._contextMenuFile = undefined;
    }

    for (const target of this.focusedDecoration.appliedTargets.keys()) {
      // ???????????????????????????
      this.focusedDecoration.removeTarget(target);
    }

    let shouldUpdate = false;
    if (Array.isArray(targetFiles) && targetFiles.length) {
      if (this.selectedFiles.length > 0) {
        this.selectedFiles.forEach((file) => {
          this.selectedDecoration.removeTarget(file);
        });
      }
      for (const targetFile of targetFiles) {
        this.selectedDecoration.addTarget(targetFile);
      }
      this._selectedFiles = targetFiles;
      shouldUpdate = true;
    }

    if (focusFile) {
      this.focusedDecoration.addTarget(focusFile);
      this._focusedFile = focusFile;
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      // ??????????????????
      this.treeModel.dispatchChange();
    }
  };

  // ??????????????????/??????????????????????????????????????????
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

      // ??????????????????
      this.treeModel.dispatchChange();
    }
  };

  // ?????????????????????????????????????????????????????????
  // removePreFocusedDecoration ??????????????????????????????????????????????????????????????????????????????????????????????????????
  activeFileFocusedDecoration = (target: SCMResourceFile | SCMResourceFolder, removePreFocusedDecoration = false) => {
    if (target === this.treeModel.root) {
      // ?????????????????????
      return;
    }

    if (this.focusedFile !== target) {
      if (removePreFocusedDecoration) {
        if (this.focusedFile) {
          // ??????????????????????????????????????????
          this.focusedDecoration.removeTarget(this.focusedFile);
        }
        this._contextMenuFile = target;
      } else if (this.focusedFile) {
        this._contextMenuFile = undefined;
        this.focusedDecoration.removeTarget(this.focusedFile);
      }
      if (target) {
        // ??????????????????????????????????????????
        if (this._selectedFiles.indexOf(target) < 0) {
          this.selectedDecoration.addTarget(target);
          this._selectedFiles.push(target);
        }
        this.focusedDecoration.addTarget(target);
        this._focusedFile = target;
      }
    }
    // ??????????????????
    this.treeModel.dispatchChange();
  };

  // ????????????????????????????????????????????????
  activeFileSelectedDecoration = (target: SCMResourceGroup | SCMResourceFile) => {
    if (this._selectedFiles.indexOf(target) > -1) {
      return;
    }
    this._selectedFiles.push(target);
    this.selectedDecoration.addTarget(target);
    // ??????????????????
    this.treeModel.dispatchChange();
  };

  // ?????????????????????????????????????????????
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
    // ??????????????????
    this.treeModel.dispatchChange();
  };

  private async persistFileSelection(preType: SCMTreeTypes) {
    const cacheKey = await this.getCacheKey(preType);
    const treeModelCache = this.treeModelCache.get(cacheKey);
    if (!treeModelCache) {
      return;
    }
    const { selectedDecoration: preSelectedDecoration, focusedDecoration: preFocusedDecoration } = treeModelCache;

    const selectedFiles: Array<SCMResourceNotRoot> = [];
    for (const file of this.selectedFiles) {
      preSelectedDecoration.removeTarget(file);
      preFocusedDecoration.removeTarget(file);

      const targetFile = this.scmTreeService.getCachedNodeItem(file.raw.id);
      if (targetFile) {
        selectedFiles.push(targetFile);
      }
    }

    this.activeFileDecoration(selectedFiles, this.focusedFile);
  }

  // ????????????????????????
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

  // ???????????????????????????
  activeFileActivedDecoration = (target: SCMResourceGroup | SCMResourceFile | SCMResourceFolder) => {
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
    // ??????????????????
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

  handleItemToggleClick = (item: SCMResourceGroup | SCMResourceFile | SCMResourceFolder, type: TreeNodeType) => {
    this._isMutiSelected = true;
    if (type !== TreeNodeType.CompositeTreeNode && type !== TreeNodeType.TreeNode) {
      return;
    }

    this.toggleFileSelectedDecoration(item);
  };

  public handleContextMenu = (
    event: React.MouseEvent,
    item: SCMResourceGroup | SCMResourceFile,
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

    // ????????????/????????????????????????
    const args = this._isMutiSelected
      ? this._getSelectedFiles().map((file) => file.resource.toJSON())
      : [item.resource.toJSON()];

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
      // args ?????????????????????????????????
      const folderArgs = (item as unknown as SCMResourceFolder).arguments;
      this.ctxMenuRenderer.show({
        anchor: { x, y },
        menuNodes: repoMenus.getResourceFolderMenu(group).getGroupedMenuNodes()[1],
        args: folderArgs,
      });
    }
  };

  private _getSelectedFiles() {
    return this._selectedFiles.filter((r) => !!r && !SCMResourceGroup.is(r));
  }

  // ??????????????????????????????
  private activeFileDecorationByRange = (begin: number, end: number, focused: number) => {
    this.clearFileSelectedDecoration();
    for (const target of this.focusedDecoration.appliedTargets.keys()) {
      // ???????????????????????????
      this.focusedDecoration.removeTarget(target);
    }
    for (; begin <= end; begin++) {
      const file = this.treeModel.root.getTreeNodeAtIndex(begin);
      if (file) {
        if (begin === focused) {
          // ?????? VSCode ????????????????????????????????? Range ??????????????????????????????????????????????????????
          // ???????????????????????? decoration
          this.focusedDecoration.addTarget(file);
        } else if (this.focusedDecoration.hasTarget(file)) {
          this.focusedDecoration.removeTarget(file);
        }
        this._selectedFiles.push(file as SCMResourceFile);
        this.selectedDecoration.addTarget(file);
      }
    }
    // ??????????????????
    this.treeModel.dispatchChange();
  };

  public handleItemDoubleClick = (item: SCMResourceGroup | SCMResourceFile, type: TreeNodeType) => {
    if (type === TreeNodeType.TreeNode) {
      this.openFile(item as SCMResourceFile);
      // ?????? pin ???????????????????????? editor
      const { currentEditorGroup, currentEditor } = this.workbenchEditorService;
      if (currentEditorGroup && currentEditor && currentEditor.currentUri) {
        // uri ??????????????????????????? editor pin ???
        if (URI.from((item.resource as ISCMResource).sourceUri).isEqual(currentEditor.currentUri)) {
          currentEditorGroup.pin(currentEditor.currentUri);
        }
      }
    } else {
      if (this.listOpenMode === 'doubleClick') {
        this.toggleDirectory(item as SCMResourceGroup);
      }
    }
  };

  private get listOpenMode() {
    return this.corePreferences['workbench.list.openMode'];
  }

  public handleItemClick = (item: SCMResourceGroup | SCMResourceFile, type: TreeNodeType) => {
    this._isMutiSelected = false;

    // ???????????????????????????????????????
    this.activeFileDecoration([item], item);

    // ???????????????????????????
    // ???????????????????????????????????????
    if (this.listOpenMode === 'singleClick') {
      if (type === TreeNodeType.TreeNode) {
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
          this.openFile(openFileItem);
        }
      } else {
        this.toggleDirectory(item as SCMResourceGroup);
      }
    }
  };

  private openFile = (item: SCMResourceFile) => {
    const scmResource = item.resource as ISCMResource;
    scmResource.open(true /* preverseFocus ????????? editorOptions ?????? */);
  };

  public toggleDirectory = (item: SCMResourceGroup | SCMResourceFolder) => {
    if (item.expanded) {
      this.scmTreeHandle.collapseNode(item);
    } else {
      this.scmTreeHandle.expandNode(item);
    }
  };

  /**
   * ?????????????????????????????????
   * ??????: ?????? SCM ???????????? List???Tree ???????????????????????????????????????????????????
   */
  async refresh(node: SCMResourceFolder = this.treeModel?.root as SCMResourceFolder) {
    node?.refresh();
  }

  public flushEventQueue = () => {
    let promise: Promise<any>;
    if (!this._changeEventDispatchQueue || this._changeEventDispatchQueue.length === 0) {
      return;
    }
    this._changeEventDispatchQueue.sort((pathA, pathB) => {
      const pathADepth = Path.pathDepth(pathA);
      const pathBDepth = Path.pathDepth(pathB);
      return pathADepth - pathBDepth;
    });
    const roots = [this._changeEventDispatchQueue[0]];
    for (const path of this._changeEventDispatchQueue) {
      if (roots.some((root) => path.indexOf(root) === 0)) {
        continue;
      } else {
        roots.push(path);
      }
    }
    promise = pSeries(
      roots.map((path) => async () => {
        const watcher = this.treeModel.root?.watchEvents.get(path);
        if (watcher && typeof watcher.callback === 'function') {
          await watcher.callback({ type: WatchEvent.Changed, path });
        }
        return null;
      }),
    );
    // ??????????????????
    this._changeEventDispatchQueue = [];
    return promise;
  };
}
