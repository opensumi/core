/* eslint-disable import/order */
import { Injectable, Autowired, INJECTOR_TOKEN, Injector, Optional } from '@opensumi/di';
import { DecorationsManager, Decoration, IRecycleTreeHandle, TreeModel } from '@opensumi/ide-components';
import { DisposableCollection, Emitter, Event, Disposable, runWhenIdle } from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor/lib/common/index';
import { ICommentsService } from '../../common/index';

import { CommentContentNode, CommentFileNode, CommentReplyNode, CommentRoot } from './tree-node.defined';
import styles from './tree-node.module.less';

export interface IEditorTreeHandle extends IRecycleTreeHandle {
  hasDirectFocus: () => boolean;
}

@Injectable({ multiple: true })
export class CommentTreeModel extends TreeModel {
  constructor(@Optional() root: CommentRoot) {
    super();
    this.init(root);
  }
}

@Injectable()
export class CommentModelService extends Disposable {
  @Autowired(ICommentsService)
  private readonly commentService: ICommentsService;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(WorkbenchEditorService)
  protected readonly editorService: WorkbenchEditorService;

  private _treeModel: CommentTreeModel;

  private _whenReady: Promise<void>;

  private _decorations: DecorationsManager;
  private _commentTreeHandle: IRecycleTreeHandle;

  // All decoration
  private selectedDecoration: Decoration = new Decoration(styles.mod_selected); // selected
  private focusedDecoration: Decoration = new Decoration(styles.mod_focused); // focused

  private _focusedNode: CommentFileNode | CommentContentNode | CommentReplyNode | null;
  private _selectedNodes: (CommentFileNode | CommentContentNode | CommentReplyNode)[] = [];

  private onDidUpdateTreeModelEmitter: Emitter<CommentTreeModel | undefined> = new Emitter();

  private disposableCollection: DisposableCollection = new DisposableCollection();

  constructor() {
    super();
    this._whenReady = this.initTreeModel();
  }

  get onDidUpdateTreeModel(): Event<CommentTreeModel | undefined> {
    return this.onDidUpdateTreeModelEmitter.event;
  }

  get whenReady() {
    return this._whenReady;
  }

  get commentTreeHandle() {
    return this._commentTreeHandle;
  }

  get decorations() {
    return this._decorations;
  }

  get treeModel() {
    return this._treeModel;
  }

  get focusedNode() {
    return this._focusedNode;
  }

  get selectedNodes() {
    return this._selectedNodes;
  }

  async initTreeModel() {
    const childs = await this.commentService.resolveChildren();
    if (!childs) {
      return;
    }
    const root = childs[0];
    if (!root) {
      return;
    }
    this._treeModel = this.injector.get<any>(CommentTreeModel, [root]);
    await this._treeModel.ensureReady;

    this.initDecorations(root);

    this.disposables.push(
      Event.any(
        this.commentService.onThreadsCommentChange,
        this.commentService.onThreadsChanged,
        this.commentService.onThreadsCreated,
      )(() => {
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
    this._commentTreeHandle = handle;
  }

  applyFocusedDecoration = (target: CommentFileNode | CommentContentNode | CommentReplyNode, dispatch = true) => {
    if (target) {
      for (const target of this._selectedNodes) {
        this.selectedDecoration.removeTarget(target);
      }
      if (this.focusedNode) {
        this.focusedDecoration.removeTarget(this.focusedNode);
      }
      this.selectedDecoration.addTarget(target);
      this.focusedDecoration.addTarget(target);
      this._focusedNode = target;
      this._selectedNodes = [target];

      dispatch && this.treeModel?.dispatchChange();
    }
  };

  removeFocusedDecoration = () => {
    if (this.focusedNode) {
      this.focusedDecoration.removeTarget(this.focusedNode);
      this.treeModel?.dispatchChange();
    }
    this._focusedNode = null;
  };

  handleTreeBlur = () => {
    this.removeFocusedDecoration();
  };

  handleTwistierClick = async (_, node: CommentFileNode | CommentContentNode | CommentReplyNode) => {
    if (CommentFileNode.is(node) || (node as CommentContentNode)?.isAllowToggle) {
      this.toggleDirectory(node as CommentFileNode | CommentContentNode);
    }
  };

  handleItemClick = async (_, node: CommentFileNode | CommentContentNode | CommentReplyNode) => {
    this.applyFocusedDecoration(node);
    if (CommentFileNode.is(node) || (node as CommentContentNode)?.isAllowToggle) {
      this.toggleDirectory(node as CommentFileNode | CommentContentNode);
    }
    let uri;
    let range;

    if (node instanceof CommentReplyNode || node instanceof CommentContentNode) {
      uri = node.thread.uri;
      range = node.thread.range;
    } else {
      uri = node.resource;
    }

    this.editorService
      .open(uri, {
        range,
      })
      .then(() => {
        if ((node as CommentReplyNode | CommentContentNode).thread) {
          (node as CommentReplyNode | CommentContentNode).thread.show();
        }
      });
  };

  toggleDirectory = (item: CommentFileNode | CommentContentNode) => {
    if (item.expanded) {
      this.commentTreeHandle.collapseNode(item);
    } else {
      this.commentTreeHandle.expandNode(item);
    }
  };

  async refresh() {
    await this.whenReady;
    runWhenIdle(() => {
      this.treeModel.root.refresh();
    });
  }

  async collapsedAll() {
    await this.whenReady;
    return this.treeModel.root.collapsedAll();
  }

  dispose() {
    this.disposableCollection.dispose();
  }
}
