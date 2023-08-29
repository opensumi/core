import { Injectable, Autowired, INJECTOR_TOKEN, Injector, Optional } from '@opensumi/di';
import { DecorationsManager, Decoration, IRecycleTreeHandle, TreeModel } from '@opensumi/ide-components';
import {
  DisposableCollection,
  Emitter,
  Event,
  URI,
  SearchSettingId,
  formatLocalize,
  Schemes,
  Disposable,
  runWhenIdle,
} from '@opensumi/ide-core-browser';
import { AbstractContextMenuService, ICtxMenuRenderer, MenuId } from '@opensumi/ide-core-browser/lib/menu/next/index';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { IContentSearchClientService, ISearchTreeService } from '../../common/content-search';
import { SearchPreferences } from '../search-preferences';

import {
  RangeHighlightDecorations,
  ReplaceDocumentModelContentProvider,
  SearchTreeService,
} from './search-tree.service';
import { SearchContentNode, SearchFileNode, SearchRoot } from './tree-node.defined';
import styles from './tree-node.module.less';

export interface IEditorTreeHandle extends IRecycleTreeHandle {
  hasDirectFocus: () => boolean;
}

@Injectable({ multiple: true })
export class SearchTreeModel extends TreeModel {
  constructor(@Optional() root: SearchRoot) {
    super();
    this.init(root);
  }
}

@Injectable()
export class SearchModelService extends Disposable {
  @Autowired(ISearchTreeService)
  private readonly searchTreeService: SearchTreeService;

  @Autowired(IContentSearchClientService)
  private readonly searchService: IContentSearchClientService;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired(ReplaceDocumentModelContentProvider)
  private replaceDocumentModelContentProvider: ReplaceDocumentModelContentProvider;

  @Autowired(RangeHighlightDecorations)
  private rangeHighlightDecorations: RangeHighlightDecorations;

  @Autowired(ICtxMenuRenderer)
  private readonly ctxMenuRenderer: ICtxMenuRenderer;

  @Autowired(AbstractContextMenuService)
  private readonly contextMenuService: AbstractContextMenuService;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(SearchPreferences)
  private searchPreferences: SearchPreferences;

  private _treeModel: SearchTreeModel;

  private _whenReady: Promise<void>;

  private _decorations: DecorationsManager;
  private _searchTreeHandle: IRecycleTreeHandle;

  // All decoration
  private selectedDecoration: Decoration = new Decoration(styles.mod_selected); // selected
  private focusedDecoration: Decoration = new Decoration(styles.mod_focused); // focused
  private contextMenuDecoration: Decoration = new Decoration(styles.mod_actived); // contextMenu actived

  private _focusedNode: SearchFileNode | SearchContentNode | null;
  private _selectedNodes: (SearchFileNode | SearchContentNode)[] = [];
  private _contextMenuNode: SearchFileNode | SearchContentNode | null;

  private onDidUpdateTreeModelEmitter: Emitter<SearchTreeModel | undefined> = new Emitter();

  private disposableCollection: DisposableCollection = new DisposableCollection();

  constructor() {
    super();
    this._whenReady = this.initTreeModel();
    this.addDispose(this.rangeHighlightDecorations);
  }

  get onDidUpdateTreeModel(): Event<SearchTreeModel | undefined> {
    return this.onDidUpdateTreeModelEmitter.event;
  }

  get whenReady() {
    return this._whenReady;
  }

  get searchTreeHandle() {
    return this._searchTreeHandle;
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

  get contextMenuNode() {
    return this._contextMenuNode;
  }

  async initTreeModel() {
    const childs = await this.searchTreeService.resolveChildren();
    if (!childs) {
      return;
    }
    const root = childs[0];
    if (!root) {
      return;
    }
    this._treeModel = this.injector.get<any>(SearchTreeModel, [root]);
    await this._treeModel.ensureReady;

    this.initDecorations(root);

    this.disposables.push(
      this.searchService.onDidChange(() => {
        if (this.searchService.searchResults.size > 0) {
          this.searchTreeService.contextKey.hasSearchResults.set(true);
        } else {
          this.searchTreeService.contextKey.hasSearchResults.set(false);
        }
        this.refresh();
      }),
    );

    this.onDidUpdateTreeModelEmitter.fire(this._treeModel);
  }

  initDecorations(root) {
    this._decorations = new DecorationsManager(root as any);
    this._decorations.addDecoration(this.selectedDecoration);
    this._decorations.addDecoration(this.focusedDecoration);
    this._decorations.addDecoration(this.contextMenuDecoration);
    return this._decorations;
  }

  handleTreeHandler(handle: IRecycleTreeHandle) {
    this._searchTreeHandle = handle;
  }

  applyFocusedDecoration = (target: SearchFileNode | SearchContentNode, dispatch = true) => {
    if (this.contextMenuNode) {
      this.focusedDecoration.removeTarget(this.contextMenuNode);
      this.selectedDecoration.removeTarget(this.contextMenuNode);
      this.contextMenuDecoration.removeTarget(this.contextMenuNode);
      this._contextMenuNode = null;
    }
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

  applyContextMenuDecoration = (target: SearchFileNode | SearchContentNode) => {
    if (this.contextMenuNode) {
      this.contextMenuDecoration.removeTarget(this.contextMenuNode);
    }
    if (this.focusedNode) {
      this.focusedDecoration.removeTarget(this.focusedNode);
      this._focusedNode = null;
    }
    this.contextMenuDecoration.addTarget(target);
    this._contextMenuNode = target;
    this.treeModel.dispatchChange();
  };

  removeFocusedDecoration = () => {
    if (this.focusedNode) {
      this.focusedDecoration.removeTarget(this.focusedNode);
      this.treeModel?.dispatchChange();
    }
    this._focusedNode = null;
  };

  handleTreeBlur = () => {
    this.searchTreeService.contextKey.searchViewFocusedKey.set(false);
    this.removeFocusedDecoration();
  };

  handleTreeFocus = () => {
    this.searchTreeService.contextKey.searchViewFocusedKey.set(true);
  };

  handleContextMenu = (ev: React.MouseEvent, node?: SearchFileNode | SearchContentNode) => {
    if (!node) {
      this.removeFocusedDecoration();
      return;
    }

    this.applyContextMenuDecoration(node);
    const menus = this.contextMenuService.createMenu({
      id: MenuId.SearchContext,
      contextKeyService: this.searchTreeService.contextKey.service,
    });
    const menuNodes = menus.getMergedMenuNodes();
    menus.dispose();

    const { x, y } = ev.nativeEvent;

    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: [node],
    });
  };

  handleItemClick = async (ev: React.MouseEvent, node: SearchFileNode | SearchContentNode, preview = true) => {
    this.applyFocusedDecoration(node);
    if (SearchFileNode.is(node)) {
      this.toggleDirectory(node);
    } else if (node.contentResult) {
      const result = node.contentResult;
      const isReplaceView = this.searchPreferences[SearchSettingId.UseReplacePreview];
      if (isReplaceView && this.searchTreeService.replaceValue) {
        // Open diff editor
        const originalURI = new URI(result.fileUri);
        const replaceURI = this.toReplaceResource(originalURI);

        await this.replaceDocumentModelContentProvider.updateContent(replaceURI);

        const openResourceResult = await this.workbenchEditorService.open(
          URI.from({
            scheme: 'diff',
            query: URI.stringifyQuery({
              name: formatLocalize('search.fileReplaceChanges', originalURI.displayName, replaceURI.displayName),
              original: originalURI,
              modified: replaceURI,
            }),
          }),
          {
            preview,
          },
        );
        if (openResourceResult) {
          const group = openResourceResult.group;
          const editor = group.currentEditor;
          if (editor) {
            const monaco = editor.monacoEditor;
            monaco.revealLineInCenter(result.line);
          }
        }
        this.replaceDocumentModelContentProvider.delete(replaceURI);
      } else {
        const uri = new URI(result.fileUri);
        const openResourceResult = await this.workbenchEditorService.open(new URI(result.fileUri), {
          preview,
          focus: !preview,
          range: {
            startLineNumber: result.line,
            startColumn: result.matchStart,
            endLineNumber: result.line,
            endColumn: result.matchStart + result.matchLength,
          },
        });
        if (openResourceResult && !openResourceResult.resource.deleted) {
          this.rangeHighlightDecorations.highlightRange(
            uri,
            new monaco.Range(result.line, result.matchStart, result.line, result.matchStart + result.matchLength),
          );
        }
      }
    }
  };

  handleItemDoubleClick = (ev: React.MouseEvent, node: SearchFileNode | SearchContentNode) => {
    if (!SearchFileNode.is(node)) {
      this.handleItemClick(ev, node, false);
    }
  };

  toggleDirectory = (item: SearchFileNode) => {
    if (item.expanded) {
      this.searchTreeHandle.collapseNode(item);
    } else {
      this.searchTreeHandle.expandNode(item);
    }
  };

  async refresh() {
    await this.whenReady;
    runWhenIdle(() => {
      this.treeModel.root.refresh();
    });
  }

  collapsedAll() {
    return this.treeModel.root.collapsedAll();
  }

  expandAll() {
    return this.treeModel.root.expandedAll();
  }

  private toReplaceResource(fileResource: URI) {
    const REPLACE_PREVIEW = 'replacePreview';
    return fileResource
      .withScheme(Schemes.internal)
      .withFragment(REPLACE_PREVIEW)
      .withQuery(JSON.stringify({ scheme: fileResource.scheme }));
  }

  dispose() {
    this.disposableCollection.dispose();
  }
}
