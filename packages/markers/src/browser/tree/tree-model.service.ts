import { Injectable, Autowired, INJECTOR_TOKEN, Injector, Optional } from '@opensumi/di';
import { DecorationsManager, Decoration, IRecycleTreeHandle, TreeModel } from '@opensumi/ide-components';
import { DisposableCollection, Deferred, Emitter, Event, URI, runWhenIdle } from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor';

import { IMarkerService } from '../../common/types';

import { MarkerGroupNode, MarkerNode, MarkerRoot } from './tree-node.defined';
import styles from './tree-node.module.less';

export interface IEditorTreeHandle extends IRecycleTreeHandle {
  hasDirectFocus: () => boolean;
}

@Injectable({ multiple: true })
export class MarkerTreeModel extends TreeModel {
  constructor(@Optional() root: MarkerRoot) {
    super();
    this.init(root);
  }
}

@Injectable()
export class MarkerModelService {
  @Autowired(IMarkerService)
  private readonly markerService: IMarkerService;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  private _treeModel: MarkerTreeModel;

  private _whenReady: Promise<void>;

  private _decorations: DecorationsManager;
  private _markerTreeHandle: IRecycleTreeHandle;

  private refreshDeferred: Deferred<void> | null;

  // 装饰器
  private selectedDecoration: Decoration = new Decoration(styles.mod_selected); // 选中态
  private focusedDecoration: Decoration = new Decoration(styles.mod_focused); // 焦点态
  // 即使选中态也是焦点态的节点
  private _focusedNode: MarkerGroupNode | MarkerNode | undefined;
  // 选中态的节点
  private _selectedNodes: (MarkerGroupNode | MarkerNode)[] = [];
  private onDidUpdateTreeModelEmitter: Emitter<MarkerTreeModel | undefined> = new Emitter();

  private preContextMenuFocusedNode: MarkerGroupNode | MarkerNode | null;

  private disposableCollection: DisposableCollection = new DisposableCollection();

  constructor() {
    this._whenReady = this.initTreeModel();
  }

  get whenReady() {
    return this._whenReady;
  }

  get flushEventQueuePromise() {
    return this.refreshDeferred && this.refreshDeferred.promise;
  }

  get markerTreeHandle() {
    return this._markerTreeHandle;
  }

  get decorations() {
    return this._decorations;
  }

  get treeModel() {
    return this._treeModel;
  }

  get onDidUpdateTreeModel(): Event<MarkerTreeModel | undefined> {
    return this.onDidUpdateTreeModelEmitter.event;
  }

  // 既是选中态，也是焦点态节点
  get focusedNode() {
    return this._focusedNode;
  }
  // 是选中态，非焦点态节点
  get selectedNodes() {
    return this._selectedNodes;
  }

  async initTreeModel() {
    const childs = await this.markerService.resolveChildren();
    if (!childs) {
      return;
    }
    const root = childs[0];
    if (!root) {
      return;
    }
    this._treeModel = this.injector.get<any>(MarkerTreeModel, [root]);
    await this._treeModel.ensureReady;

    this.initDecorations(root);

    this.disposableCollection.push(
      this.markerService.getManager().onMarkerChanged(() => {
        this.refresh();
      }),
    );
    this.disposableCollection.push(
      this.markerService.onMarkerFilterChanged(() => {
        this.refresh();
      }),
    );

    this.onDidUpdateTreeModelEmitter.fire(this._treeModel);
  }

  initDecorations(root) {
    this._decorations = new DecorationsManager(root as any);
    this._decorations.addDecoration(this.selectedDecoration);
    this._decorations.addDecoration(this.focusedDecoration);
    return this._decorations;
  }

  handleTreeHandler(handle: IRecycleTreeHandle) {
    this._markerTreeHandle = handle;
  }

  // 清空其他选中/焦点态节点，更新当前焦点节点
  activeNodeDecoration = (target: MarkerGroupNode | MarkerNode, dispatch = true) => {
    if (this.preContextMenuFocusedNode) {
      this.focusedDecoration.removeTarget(this.preContextMenuFocusedNode);
      this.selectedDecoration.removeTarget(this.preContextMenuFocusedNode);
      this.preContextMenuFocusedNode = null;
    }
    if (target) {
      for (const target of this.selectedDecoration.appliedTargets.keys()) {
        this.selectedDecoration.removeTarget(target);
      }
      for (const target of this.focusedDecoration.appliedTargets.keys()) {
        this.focusedDecoration.removeTarget(target);
      }
      this.selectedDecoration.addTarget(target);
      this.focusedDecoration.addTarget(target);
      this._focusedNode = target;
      this._selectedNodes = [target];

      // 通知视图更新
      dispatch && this.treeModel?.dispatchChange();
    }
  };

  // 取消选中节点焦点
  enactiveNodeDecoration = () => {
    if (this.focusedNode) {
      this.focusedDecoration.removeTarget(this.focusedNode);
      this.treeModel?.dispatchChange();
    }
    this._focusedNode = undefined;
  };

  // 清空焦点状态
  handleTreeBlur = () => {
    this.enactiveNodeDecoration();
  };

  handleItemClick = (item: MarkerGroupNode | MarkerNode) => {
    this.activeNodeDecoration(item);
    if (MarkerGroupNode.is(item)) {
      this.toggleDirectory(item);
    } else if (item.marker) {
      this.workbenchEditorService.open(new URI(item.marker.resource), {
        disableNavigate: true,
        range: {
          startLineNumber: item.marker.startLineNumber,
          startColumn: item.marker.startColumn,
          endLineNumber: item.marker.endLineNumber,
          endColumn: item.marker.endColumn,
        },
      });
    }
  };

  toggleDirectory = async (item: MarkerGroupNode) => {
    if (item.expanded) {
      this.markerTreeHandle.collapseNode(item);
    } else {
      this.markerTreeHandle.expandNode(item);
    }
  };

  async refresh() {
    await this.whenReady;
    runWhenIdle(() => {
      this.treeModel.root.refresh();
    });
  }

  dispose() {
    this.disposableCollection.dispose();
  }
}
