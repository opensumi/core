import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { DecorationsManager, Decoration, IRecycleTreeHandle, TreeNodeType, WatchEvent } from '@ali/ide-components';
import { URI, DisposableCollection, Emitter, CommandService, Deferred, Event, MaybeNull, MarkerManager, IPosition, IRange } from '@ali/ide-core-browser';
import * as styles from '../outline-node.module.less';
import { Path } from '@ali/ide-core-common/lib/path';
import { OutlineEventService } from './outline-event.service';
import { WorkbenchEditorService } from '@ali/ide-editor/lib/browser';
import { OutlineTreeService } from './outline-tree.service';
import { OutlineTreeNode, OutlineCompositeTreeNode } from '../outline-node.define';
import { OutlineTreeModel } from './outline-model';
import { DocumentSymbolStore, INormalizedDocumentSymbol } from '@ali/ide-editor/lib/browser/breadcrumb/document-symbol';
import { IOutlineDecorationService } from '../../common';
import * as pSeries from 'p-series';

export interface IEditorTreeHandle extends IRecycleTreeHandle {
  hasDirectFocus: () => boolean;
}

@Injectable()
export class OutlineModelService {
  private static DEFAULT_FLUSH_FILE_EVENT_DELAY = 100;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(OutlineTreeService)
  private readonly outlineTreeService: OutlineTreeService;

  @Autowired(MarkerManager)
  private markerManager: MarkerManager;

  @Autowired(IOutlineDecorationService)
  public decorationService: IOutlineDecorationService;

  @Autowired(OutlineEventService)
  public readonly outlineEventService: OutlineEventService;

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorService;

  @Autowired(CommandService)
  public readonly commandService: CommandService;

  @Autowired(DocumentSymbolStore)
  private documentSymbolStore: DocumentSymbolStore;

  private _treeModel: OutlineTreeModel;
  private _whenReady: Promise<void>;

  private _decorations: DecorationsManager;
  private _outlineTreeHandle: IEditorTreeHandle;

  public flushEventQueueDeferred: Deferred<void> | null;
  private _eventFlushTimeout: number;
  private _changeEventDispatchQueue: string[] = [];

  // 装饰器
  private selectedDecoration: Decoration = new Decoration(styles.mod_selected); // 选中态
  private focusedDecoration: Decoration = new Decoration(styles.mod_focused); // 焦点态
  private dirtyDecoration: Decoration = new Decoration(styles.mod_dirty); // 修改态
  // 即使选中态也是焦点态的节点
  private _focusedNode: OutlineCompositeTreeNode | OutlineTreeNode | undefined;
  // 选中态的节点
  private _selectedNodes: (OutlineCompositeTreeNode | OutlineTreeNode)[] = [];

  private preContextMenuFocusedNode: OutlineCompositeTreeNode | OutlineTreeNode | null;

  private disposableCollection: DisposableCollection = new DisposableCollection();

  private onDidRefreshedEmitter: Emitter<void> = new Emitter();

  private _ignoreFollowCursorUpdateEventTimer: number = 0;

  constructor() {
    this._whenReady = this.initTreeModel();
  }

  get flushEventQueuePromise() {
    return this.flushEventQueueDeferred && this.flushEventQueueDeferred.promise;
  }

  get outlineTreeHandle() {
    return this._outlineTreeHandle;
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
  get focusedNode() {
    return this._focusedNode;
  }
  // 是选中态，非焦点态节点
  get selectedNodes() {
    return this._selectedNodes;
  }

  get onDidRefreshed(): Event<void> {
    return this.onDidRefreshedEmitter.event;
  }

  async initTreeModel() {
    await this.outlineTreeService.whenReady;

    this.outlineTreeService.currentUri = this.editorService.currentEditor?.currentUri;

    // 根据是否为多工作区创建不同根节点
    const root = (await this.outlineTreeService.resolveChildren())[0];
    if (!root) {
      return;
    }
    this._treeModel = this.injector.get<any>(OutlineTreeModel, [root]);

    this.initDecorations(root);

    this.disposableCollection.push(this.markerManager.onMarkerChanged((resources) => {
      if (this.outlineTreeService.currentUri && resources.find((resource) => resource === this.outlineTreeService.currentUri!.toString())) {
        this.refresh();
      }
    }));

    this.disposableCollection.push(this.outlineEventService.onDidActiveChange((uri: URI) => {
      if ((!this.outlineTreeService.currentUri && !!uri) || (!!this.outlineTreeService.currentUri && !uri) || (!!this.outlineTreeService.currentUri && !!uri && !uri.isEqual(this.outlineTreeService.currentUri!))) {
        this.outlineTreeService.currentUri = uri;
        this.refresh();
      } else {
        this.outlineTreeService.currentUri = null;
        this.refresh();
      }
    }));

    this.disposableCollection.push(this.outlineEventService.onDidSelectionChange(() => {
      this.refresh();
    }));

    this.disposableCollection.push(this.outlineEventService.onDidChange(() => {
      this.refresh();
    }));

    this.disposableCollection.push(this.outlineTreeService.onDidChange(() => {
      this.refresh();
    }));

    this.disposableCollection.push(this.treeModel.onWillUpdate(() => {
      if (this.outlineTreeService.followCursor && this.outlineTreeService.currentUri) {
        // 如果设置了跟随光标，此时查询一下当前焦点节点
        const symbols = this.documentSymbolStore.getDocumentSymbol(this.outlineTreeService.currentUri);
        if (symbols) {
          const activeSymbols = this.findCurrentDocumentSymbol(symbols, this.editorService.currentEditorGroup.codeEditor.monacoEditor.getPosition());
          const node = this.outlineTreeService.getTreeNodeBySymbol(activeSymbols[activeSymbols.length - 1]);
          if (!!node) {
            this.activeNodeDecoration(node as OutlineTreeNode, false);
            if (this._ignoreFollowCursorUpdateEventTimer) {
              this._ignoreFollowCursorUpdateEventTimer--;
              return;
            } else {
              this.location(node as OutlineTreeNode);
            }
          }
        }

      } else if (!!this.focusedNode) {
        // 更新树前更新下选中节点
        const node = this.treeModel?.root.getTreeNodeById(this.focusedNode.id);
        this.activeNodeDecoration(node as OutlineTreeNode, false);
      } else if (this.selectedNodes.length !== 0) {
        // 仅处理一下单选情况
        const node = this.treeModel?.root.getTreeNodeById(this.selectedNodes[0].id);
        this.selectNodeDecoration(node as OutlineTreeNode, false);
      }
    }));
  }

  initDecorations(root) {
    this._decorations = new DecorationsManager(root as any);
    this._decorations.addDecoration(this.selectedDecoration);
    this._decorations.addDecoration(this.focusedDecoration);
    this._decorations.addDecoration(this.dirtyDecoration);
  }

  private findCurrentDocumentSymbol(documentSymbols: INormalizedDocumentSymbol[], position: MaybeNull<IPosition>): INormalizedDocumentSymbol[] {
    const result: INormalizedDocumentSymbol[] = [];
    if (!position) {
      return result;
    }
    let toFindIn: INormalizedDocumentSymbol[] | undefined = documentSymbols;
    while (toFindIn && toFindIn.length > 0) {
      let found = false;
      for (const documentSymbol of toFindIn) {
        if (this.positionInRange(position, documentSymbol.range)) {
          result.push(documentSymbol);
          toFindIn = documentSymbol.children;
          found = true;
          break;
        }
      }
      if (!found) {
        break;
      }
    }
    return result;
  }

  private positionInRange(pos: IPosition, range: IRange): boolean {
    if (pos.lineNumber < range.startLineNumber) {
      return false;
    } else if (pos.lineNumber === range.startLineNumber) {
      return pos.column >= range.startColumn;
    } else if (pos.lineNumber < range.endLineNumber) {
      return true;
    } else if (pos.lineNumber === range.endLineNumber) {
      return pos.column <= range.endColumn;
    } else {
      return false;
    }
  }
  // 清空所有节点选中态
  clearNodeSelectedDecoration = () => {
    this._selectedNodes.forEach((file) => {
      this.selectedDecoration.removeTarget(file);
    });
    this._selectedNodes = [];
  }

  // 清空其他选中/焦点态节点，更新当前焦点节点
  activeNodeDecoration = (target: OutlineCompositeTreeNode | OutlineTreeNode, dispatch: boolean = true) => {
    if (this.preContextMenuFocusedNode) {
      this.focusedDecoration.removeTarget(this.preContextMenuFocusedNode);
      this.selectedDecoration.removeTarget(this.preContextMenuFocusedNode);
      this.preContextMenuFocusedNode = null;
    }
    if (target) {
      if (this.selectedNodes.length > 0) {
        this.selectedNodes.forEach((file) => {
          this.selectedDecoration.removeTarget(file);
        });
      }
      if (this.focusedNode) {
        this.focusedDecoration.removeTarget(this.focusedNode);
      }
      this.selectedDecoration.addTarget(target);
      this.focusedDecoration.addTarget(target);
      this._focusedNode = target;
      this._selectedNodes = [target];

      // 通知视图更新
      dispatch && this.treeModel.dispatchChange();
    }
  }

  // 清空其他选中/焦点态节点，更新当前选中节点
  selectNodeDecoration = (target: OutlineCompositeTreeNode | OutlineTreeNode, dispatch: boolean = true) => {
    if (this.preContextMenuFocusedNode) {
      this.focusedDecoration.removeTarget(this.preContextMenuFocusedNode);
    }
    if (target) {
      if (this.selectedNodes.length > 0) {
        this.selectedNodes.forEach((node) => {
          this.selectedDecoration.removeTarget(node);
        });
      }
      if (this.focusedNode) {
        this.focusedDecoration.removeTarget(this.focusedNode);
      }
      this.selectedDecoration.addTarget(target);
      this._selectedNodes = [target];

      // 通知视图更新
      dispatch && this.treeModel.dispatchChange();
    }
  }

  // 清空其他焦点态节点，更新当前焦点节点，
  // removePreFocusedDecoration 表示更新焦点节点时如果此前已存在焦点节点，之前的节点装饰器将会被移除
  activeNodeFocusedDecoration = (target: OutlineCompositeTreeNode | OutlineTreeNode, removePreFocusedDecoration: boolean = false) => {
    if (this.focusedNode !== target) {
      if (removePreFocusedDecoration) {
        // 当存在上一次右键菜单激活的文件时，需要把焦点态的文件节点的装饰器全部移除
        if (this.preContextMenuFocusedNode) {
          this.focusedDecoration.removeTarget(this.preContextMenuFocusedNode);
          this.selectedDecoration.removeTarget(this.preContextMenuFocusedNode);
        } else if (!!this.focusedNode) {
          // 多选情况下第一次切换焦点文件
          this.focusedDecoration.removeTarget(this.focusedNode);
        }
        this.preContextMenuFocusedNode = target;
      } else if (!!this.focusedNode) {
        this.preContextMenuFocusedNode = null;
        this.focusedDecoration.removeTarget(this.focusedNode);
      }
      if (target) {
        this.selectedDecoration.addTarget(target);
        this.focusedDecoration.addTarget(target);
        this._focusedNode = target;
        this._selectedNodes.push(target);
      }
    }
    // 通知视图更新
    this.treeModel.dispatchChange();
  }

  // 选中当前指定节点，添加装饰器属性
  activeNodeSelectedDecoration = (target: OutlineCompositeTreeNode | OutlineTreeNode) => {
    if (this._selectedNodes.indexOf(target) > -1) {
      return;
    }
    if (this.selectedNodes.length > 0) {
      this.selectedNodes.forEach((file) => {
        this.selectedDecoration.removeTarget(file);
      });
    }
    this._selectedNodes = [target];
    this.selectedDecoration.addTarget(target);
    // 通知视图更新
    this.treeModel.dispatchChange();
  }

  // 取消选中节点焦点
  enactiveNodeDecoration = () => {
    if (this.focusedNode) {
      this.focusedDecoration.removeTarget(this.focusedNode);
      this.treeModel.dispatchChange();
    }
    this._focusedNode = undefined;
  }

  removeNodeDecoration() {
    if (!this.decorations) {
      return;
    }
    this.decorations.removeDecoration(this.selectedDecoration);
    this.decorations.removeDecoration(this.focusedDecoration);
  }

  handleTreeHandler(handle: IEditorTreeHandle) {
    this._outlineTreeHandle = handle;
  }

  handleTreeBlur = () => {
    // 清空焦点状态
    this.enactiveNodeDecoration();
  }

  handleItemClick = (item: OutlineCompositeTreeNode | OutlineTreeNode, type: TreeNodeType) => {
    // 单选操作默认先更新选中状态
    this.activeNodeDecoration(item);

    if (type === TreeNodeType.TreeNode) {
      this.revealRange(item.raw);
    }
    this._ignoreFollowCursorUpdateEventTimer ++;
  }

  toggleDirectory = async (item: OutlineCompositeTreeNode) => {
    this._ignoreFollowCursorUpdateEventTimer ++;
    if (item.expanded) {
      this.outlineTreeHandle.collapseNode(item);
    } else {
      this.outlineTreeHandle.expandNode(item);
    }
  }

  protected revealRange(symbol: INormalizedDocumentSymbol) {
    const currentEditor = this.editorService.currentEditorGroup.codeEditor;
    currentEditor.monacoEditor.revealLineInCenter(symbol.range.startLineNumber);
    currentEditor.monacoEditor.setPosition(new monaco.Position(symbol.range.startLineNumber, symbol.range.endLineNumber));
  }

  /**
   * 刷新指定下的所有子节点
   */
  async refresh(node: OutlineCompositeTreeNode = this.treeModel.root as OutlineCompositeTreeNode) {
    await this.whenReady;
    if (OutlineCompositeTreeNode.is(node) && (node as OutlineCompositeTreeNode).parent) {
      node = (node as OutlineCompositeTreeNode).parent as OutlineCompositeTreeNode;
    }
    // 这里也可以直接调用node.forceReloadChildrenQuiet，但由于文件树刷新事件可能会较多
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
        // 刷新前需要更新诊断信息数据
        this.decorationService.updateDiagnosisInfo(this.outlineTreeService.currentUri!);
        await this.flushEventQueue()!;
        this.flushEventQueueDeferred?.resolve();
        this.flushEventQueueDeferred = null;
        callback();
      }, OutlineModelService.DEFAULT_FLUSH_FILE_EVENT_DELAY) as any;
    }
    if (this._changeEventDispatchQueue.indexOf(path) === -1) {
      this._changeEventDispatchQueue.push(path);
    }
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
    promise = pSeries(roots.map((path) => async () => {
      const watcher = this.treeModel.root?.watchEvents.get(path);
      if (watcher && typeof watcher.callback === 'function') {
        await watcher.callback({ type: WatchEvent.Changed, path });
      }
      return null;
    }));
    // 重置更新队列
    this._changeEventDispatchQueue = [];
    return promise;
  }

  public location = async (node: OutlineTreeNode) => {
    if (!node) {
      return;
    }
    node = await this.outlineTreeHandle.ensureVisible(node, 'center') as OutlineTreeNode;
  }

  public collapseAll = async () => {
    this._ignoreFollowCursorUpdateEventTimer++;
    await this.treeModel.root.collapsedAll();
  }

  dispose() {
    this.disposableCollection.dispose();
  }

}
