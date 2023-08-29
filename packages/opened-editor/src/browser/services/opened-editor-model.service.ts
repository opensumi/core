import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { DecorationsManager, Decoration, IRecycleTreeHandle, TreeNodeType, WatchEvent } from '@opensumi/ide-components';
import {
  URI,
  DisposableCollection,
  Emitter,
  IContextKeyService,
  EDITOR_COMMANDS,
  CommandService,
  ThrottledDelayer,
  Deferred,
  Event,
  path,
  pSeries,
  formatLocalize,
} from '@opensumi/ide-core-browser';
import { AbstractContextMenuService, MenuId, ICtxMenuRenderer } from '@opensumi/ide-core-browser/lib/menu/next';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { WorkbenchEditorService, IEditorGroup, IResource } from '@opensumi/ide-editor/lib/browser';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { EXPLORER_CONTAINER_ID } from '@opensumi/ide-explorer/lib/browser/explorer-contribution';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

import { ExplorerOpenedEditorViewId } from '../../common/index';
import { EditorFile, EditorFileGroup } from '../opened-editor-node.define';
import styles from '../opened-editor-node.module.less';

import { OpenedEditorDecorationService } from './opened-editor-decoration.service';
import { OpenedEditorEventService } from './opened-editor-event.service';
import { OpenedEditorModel } from './opened-editor-model';
import { OpenedEditorService } from './opened-editor-tree.service';

const { Path } = path;

export interface IEditorTreeHandle extends IRecycleTreeHandle {
  hasDirectFocus: () => boolean;
}

@Injectable()
export class OpenedEditorModelService {
  private static DEFAULT_FLUSH_FILE_EVENT_DELAY = 100;
  private static DEFAULT_LOCATION_FLUSH_DELAY = 200;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(ICtxMenuRenderer)
  private readonly ctxMenuRenderer: ICtxMenuRenderer;

  @Autowired(AbstractContextMenuService)
  private readonly contextMenuService: AbstractContextMenuService;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  @Autowired(OpenedEditorService)
  private readonly openedEditorService: OpenedEditorService;

  @Autowired(LabelService)
  public readonly labelService: LabelService;

  @Autowired(OpenedEditorDecorationService)
  public readonly decorationService: OpenedEditorDecorationService;

  @Autowired(OpenedEditorEventService)
  public readonly openedEditorEventService: OpenedEditorEventService;

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorServiceImpl;

  @Autowired(CommandService)
  public readonly commandService: CommandService;

  @Autowired(IMainLayoutService)
  private readonly layoutService: IMainLayoutService;

  private _treeModel: OpenedEditorModel | null;
  private _whenReady: Promise<void>;

  private _decorations: DecorationsManager;
  private _openedEditorTreeHandle?: IEditorTreeHandle;

  public flushEventQueueDeferred: Deferred<void> | null;
  private _eventFlushTimeout: number;
  private _changeEventDispatchQueue: string[] = [];

  // 装饰器
  private selectedDecoration: Decoration = new Decoration(styles.mod_selected); // 选中态
  private focusedDecoration: Decoration = new Decoration(styles.mod_focused); // 焦点态
  private contextMenuDecoration: Decoration = new Decoration(styles.mod_actived); // 焦点态
  // 即使选中态也是焦点态的节点
  private _focusedFile: EditorFileGroup | EditorFile | undefined;
  // 选中态的节点
  private _selectedFiles: (EditorFileGroup | EditorFile)[] = [];
  // 右键菜单选择的节点
  private _contextMenuFile: EditorFile | EditorFileGroup | undefined;

  private disposableCollection: DisposableCollection = new DisposableCollection();

  private onDidRefreshedEmitter: Emitter<void> = new Emitter();
  private onTreeModelChangeEmitter: Emitter<OpenedEditorModel | null> = new Emitter();
  private locationDelayer = new ThrottledDelayer<void>(OpenedEditorModelService.DEFAULT_LOCATION_FLUSH_DELAY);

  // 右键菜单局部ContextKeyService
  private _contextMenuContextKeyService: IContextKeyService;

  private _dirtyUris: string[] = [];

  constructor() {
    this._whenReady = this.initTreeModel();
  }

  get flushEventQueuePromise() {
    return this.flushEventQueueDeferred && this.flushEventQueueDeferred.promise;
  }

  get contextMenuContextKeyService() {
    if (!this._contextMenuContextKeyService) {
      this._contextMenuContextKeyService = this.contextKeyService.createScoped();
    }
    return this._contextMenuContextKeyService;
  }

  get editorTreeHandle() {
    return this._openedEditorTreeHandle;
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

  // 右键菜单选中的节点
  get contextMenuFile() {
    return this._contextMenuFile;
  }

  // 是选中态，非焦点态节点
  get selectedFiles() {
    return this._selectedFiles;
  }

  get onDidRefreshed(): Event<void> {
    return this.onDidRefreshedEmitter.event;
  }

  get onTreeModelChange(): Event<OpenedEditorModel | null> {
    return this.onTreeModelChangeEmitter.event;
  }

  async initTreeModel() {
    // 根据是否为多工作区创建不同根节点
    const root = (await this.openedEditorService.resolveChildren())[0];
    if (!root) {
      return;
    }

    this.initDecorations(root);

    this._treeModel = this.injector.get<any>(OpenedEditorModel, [root]);

    this.disposableCollection.push(
      Event.any<any>(
        this.labelService.onDidChange,
        this.editorService.onActiveResourceChange,
        this.editorService.onDidEditorGroupsChanged,
        this.editorService.onDidCurrentEditorGroupChanged,
        this.openedEditorEventService.onDidChange,
      )(() => {
        this.refresh();
      }),
    );

    this.disposableCollection.push(
      this.openedEditorEventService.onDidDecorationChange((payload) => {
        let shouldUpdate = false;
        if (!payload) {
          return;
        }
        if (!this.treeModel) {
          return;
        }
        for (let index = 0; index < this.treeModel.root.branchSize; index++) {
          const node = this.treeModel.root.getTreeNodeAtIndex(index);
          if (!!node && !EditorFileGroup.is(node as EditorFileGroup)) {
            if ((node as EditorFile).uri.isEqual(payload.uri)) {
              if (payload.decoration.dirty) {
                this.openedEditorService.addDirtyUri((node as EditorFile).uri.toString());
              } else {
                this.openedEditorService.removeDirtyUri((node as EditorFile).uri.toString());
              }
              shouldUpdate = true;
            }
          }
        }
        if (shouldUpdate) {
          this.setExplorerTabBarBadge();
          this.refresh();
        }
      }),
    );

    this.onTreeModelChangeEmitter.fire(this._treeModel);
  }

  initDecorations(root) {
    this._decorations = new DecorationsManager(root as any);
    this._decorations.addDecoration(this.selectedDecoration);
    this._decorations.addDecoration(this.focusedDecoration);
    this._decorations.addDecoration(this.contextMenuDecoration);
  }

  // 清空其他选中/焦点态节点，更新当前焦点节点
  activeFileDecoration = (target: EditorFileGroup | EditorFile, dispatchChange = true) => {
    if (this.contextMenuFile) {
      this.contextMenuDecoration.removeTarget(this.contextMenuFile);
      this._contextMenuFile = undefined;
    }
    if (target) {
      this.removeSelectDecoration();
      this.removeFocusedDecoration();
      this.selectedDecoration.addTarget(target);
      this.focusedDecoration.addTarget(target);
      this._focusedFile = target;
      this._selectedFiles = [target];

      // 通知视图更新
      if (dispatchChange) {
        this.treeModel?.dispatchChange();
      }
    }
  };

  // 清空其他选中/焦点态节点，更新当前选中节点
  selectFileDecoration = (target: EditorFileGroup | EditorFile, dispatchChange = true) => {
    if (this.contextMenuFile) {
      this.contextMenuDecoration.removeTarget(this.contextMenuFile);
      this._contextMenuFile = undefined;
    }
    if (target) {
      this.removeSelectDecoration();
      this.removeFocusedDecoration();
      this.selectedDecoration.addTarget(target);
      this._selectedFiles = [target];

      // 通知视图更新
      if (dispatchChange) {
        this.treeModel?.dispatchChange();
      }
    }
  };

  // 右键菜单焦点态切换
  activeFileActivedDecoration = (target: EditorFileGroup | EditorFile) => {
    if (this.contextMenuFile) {
      this.contextMenuDecoration.removeTarget(this.contextMenuFile);
    }
    this.removeFocusedDecoration();
    this.contextMenuDecoration.addTarget(target);
    this._contextMenuFile = target;
    this.treeModel?.dispatchChange();
  };

  // 取消选中节点焦点
  enactiveFileDecoration = () => {
    this.removeFocusedDecoration();
    if (this.contextMenuFile) {
      this.contextMenuDecoration.removeTarget(this.contextMenuFile);
    }
    this.treeModel?.dispatchChange();
  };
  // refresh 更新后，原保存节点已经销毁，需要根据 path 获取新的节点
  removeSelectDecoration() {
    if (this._selectedFiles.length) {
      this._selectedFiles.forEach((oldFile) => {
        const currentFileNode = this.treeModel?.root.getTreeNodeByPath(oldFile.path);
        this.selectedDecoration.removeTarget(currentFileNode || oldFile);
      });
    }
  }

  removeFocusedDecoration() {
    if (this._focusedFile) {
      const currentFileNode = this.treeModel?.root.getTreeNodeByPath(this._focusedFile.path);
      this.focusedDecoration.removeTarget(currentFileNode || this._focusedFile);
      this._focusedFile = undefined;
    }
  }

  handleContextMenu = (ev: React.MouseEvent, file?: EditorFileGroup | EditorFile) => {
    if (!file) {
      this.enactiveFileDecoration();
      return;
    }

    ev.stopPropagation();
    ev.preventDefault();

    const { x, y } = ev.nativeEvent;

    this.activeFileActivedDecoration(file);

    const menus = this.contextMenuService.createMenu({
      id: MenuId.OpenEditorsContext,
      contextKeyService: this.contextMenuContextKeyService,
    });
    const menuNodes = menus.getMergedMenuNodes();
    menus.dispose();
    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: [file],
    });
  };

  handleTreeHandler(handle: IEditorTreeHandle) {
    this._openedEditorTreeHandle = handle;
  }

  handleTreeBlur = () => {
    // 清空焦点状态
    this.enactiveFileDecoration();
  };

  handleItemClick = (item: EditorFileGroup | EditorFile, type: TreeNodeType) => {
    // 单选操作默认先更新选中状态
    this.activeFileDecoration(item);

    if (type === TreeNodeType.TreeNode) {
      this.openFile(item as EditorFile);
    }
  };

  clear() {
    this._treeModel = null;
    this.onTreeModelChangeEmitter.fire(this._treeModel);
  }

  /**
   * 刷新指定下的所有子节点
   */
  async refresh(node: EditorFileGroup = this.treeModel?.root as EditorFileGroup) {
    if (!this._treeModel) {
      await this.initTreeModel();
      return;
    }
    if (!EditorFileGroup.is(node) && (node as EditorFileGroup).parent) {
      node = (node as EditorFileGroup).parent as EditorFileGroup;
    }
    // 这里也可以直接调用node.refresh，但由于文件树刷新事件可能会较多
    // 队列化刷新动作减少更新成本
    this.queueChangeEvent(node.path, () => {
      this.onDidRefreshedEmitter.fire();
    });
  }

  // 队列化Changed事件
  private queueChangeEvent(path: string, callback: any) {
    if (!this.flushEventQueueDeferred) {
      this.flushEventQueueDeferred = new Deferred<void>();
      clearTimeout(this._eventFlushTimeout);
      this._eventFlushTimeout = setTimeout(async () => {
        await this.flushEventQueue()!;
        this.flushEventQueueDeferred?.resolve();
        this.flushEventQueueDeferred = null;
        callback();
      }, OpenedEditorModelService.DEFAULT_FLUSH_FILE_EVENT_DELAY) as any;
    }
    if (this._changeEventDispatchQueue.indexOf(path) === -1) {
      this._changeEventDispatchQueue.push(path);
    }
  }

  public flushEventQueue = () => {
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
    const promise = pSeries(
      roots.map((path) => async () => {
        const watcher = this.treeModel?.root?.watchEvents.get(path);
        if (watcher && typeof watcher.callback === 'function') {
          await watcher.callback({ type: WatchEvent.Changed, path });
        }
        return null;
      }),
    );
    // 重置更新队列
    this._changeEventDispatchQueue = [];
    return promise;
  };

  public location = async (resource: IResource | URI, group?: IEditorGroup) => {
    this.locationDelayer.trigger(async () => {
      await this.flushEventQueuePromise;
      let node = this.openedEditorService.getEditorNodeByUri(resource, group);
      if (!node) {
        return;
      }
      if (!this.editorTreeHandle) {
        return;
      }
      node = (await this.editorTreeHandle.ensureVisible(node as EditorFile)) as EditorFile;
      if (node) {
        if (this.focusedFile === node) {
          this.activeFileDecoration(node as EditorFile);
        } else {
          this.selectFileDecoration(node as EditorFile);
        }
      }
    });
  };

  public openFile = (node: EditorFile) => {
    let groupIndex = 0;
    if (node.parent && EditorFileGroup.is(node.parent as EditorFileGroup)) {
      groupIndex = (node.parent as EditorFileGroup).group.index;
    }
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, node.uri, {
      groupIndex,
      preserveFocus: true,
      disableNavigateOnOpendEditor: true,
    });
  };

  public closeFile = (node: EditorFile) => {
    this.commandService.executeCommand(EDITOR_COMMANDS.CLOSE.id, node.uri);
  };

  public closeAllByGroup = (node: EditorFileGroup) => {
    const group = node.group as IEditorGroup;
    if (group) {
      group.closeAll();
    }
  };

  public saveAllByGroup = (node: EditorFileGroup) => {
    const group = node.group as IEditorGroup;
    if (group) {
      group.saveAll();
    }
  };

  private setExplorerTabBarBadge() {
    const handler = this.layoutService.getTabbarHandler(EXPLORER_CONTAINER_ID);
    const dirtyCount = this.editorService.calcDirtyCount();
    const accordionService = this.layoutService.getAccordionService(EXPLORER_CONTAINER_ID);
    if (handler) {
      const dirtyMsg = dirtyCount > 0 ? formatLocalize('opened.editors.unsaved', dirtyCount.toString()) : '';
      handler.setBadge(dirtyCount > 0 ? dirtyCount.toString() : '');
      accordionService.updateViewBadge(ExplorerOpenedEditorViewId, dirtyMsg);
    }
  }
}
