import { Injectable, Autowired } from '@opensumi/di';
import { LabelService } from '@opensumi/ide-core-browser';
import {
  URI,
  Schemes,
  Emitter,
  IDisposable,
  DisposableStore,
  IRange,
  memoize,
  Disposable,
} from '@opensumi/ide-core-common';
import {
  IEditorDocumentModelService,
  IEditorDocumentModelContentRegistry,
  IEditorDocumentModelContentProvider,
  IEditorDocumentModelRef,
} from '@opensumi/ide-editor/lib/browser';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';
import type { IModelDeltaDecoration } from '@opensumi/ide-monaco/lib/browser/monaco-api/editor';
import type { ITextModel } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { IWorkspaceEditService } from '@opensumi/ide-workspace-edit';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { IContentSearchClientService, ISearchTreeService } from '../../common/content-search';
import { replace } from '../replace';
import { SearchContextKey } from '../search-contextkey';
import { SearchContentNode, SearchFileNode, SearchRoot } from '../tree/tree-node.defined';

@Injectable()
export class RangeHighlightDecorations implements IDisposable {
  private preDeltaDecoration: string[] | null = null;
  private _model: ITextModel | null = null;
  private _modelRef: IEditorDocumentModelRef | null = null;
  private readonly _modelDisposables = new DisposableStore();

  @Autowired(IEditorDocumentModelService)
  documentModelManager: IEditorDocumentModelService;

  removeHighlightRange() {
    if (this._model && this.preDeltaDecoration) {
      this._model.deltaDecorations(this.preDeltaDecoration, []);
    }
    this.preDeltaDecoration = null;
  }

  highlightRange(resource: URI | ITextModel, range: IRange): void {
    let model: ITextModel | null = null;
    if (URI.isUri(resource)) {
      const modelRef = this.documentModelManager.getModelReference(resource, 'highlight-range');
      if (modelRef) {
        model = modelRef.instance.getMonacoModel();
        this._modelRef = modelRef;
      }
    } else {
      model = resource;
    }

    if (model) {
      this.doHighlightRange(model, range);
    }
  }

  private doHighlightRange(model: ITextModel, range: IRange) {
    this.removeHighlightRange();
    this.preDeltaDecoration = model.deltaDecorations([], this.createEditorDecorations(range));
    this.setModel(model);
  }

  private createEditorDecorations(range: IRange) {
    return [{ range, options: RangeHighlightDecorations.RANGE_HIGHLIGHT_DECORATION }] as IModelDeltaDecoration[];
  }

  private setModel(model: ITextModel) {
    if (this._modelRef) {
      this._modelRef.dispose();
      this._modelRef = null;
    }
    if (this._model !== model) {
      this.clearModelListeners();
      this._model = model;

      this._modelDisposables.add(
        this._model.onWillDispose(() => {
          this.clearModelListeners();
          this.removeHighlightRange();
          this._model = null;
        }),
      );
    }
  }

  private clearModelListeners() {
    this._modelDisposables.clear();
  }

  dispose() {
    if (this._model) {
      this.removeHighlightRange();
      this._modelDisposables.dispose();
      this._model = null;
    }
  }

  private static readonly RANGE_HIGHLIGHT_DECORATION = {
    className: 'rangeHighlight',
    stickiness: monaco.editor.TrackedRangeStickiness.GrowsOnlyWhenTypingBefore,
    isWholeLine: true,
  };
}

@Injectable()
export class ReplaceDocumentModelContentProvider implements IEditorDocumentModelContentProvider {
  contentMap: Map<string, string> = new Map();

  @Autowired(IEditorDocumentModelService)
  private documentModelManager: IEditorDocumentModelService;

  @Autowired(IContentSearchClientService)
  private searchBrowserService: IContentSearchClientService;

  @Autowired(IWorkspaceEditService)
  private workspaceEditService: IWorkspaceEditService;

  private onDidChangeContentEvent: Emitter<URI> = new Emitter();

  handlesScheme(scheme: string) {
    return scheme === Schemes.internal;
  }

  provideEditorDocumentModelContent(uri: URI): string {
    return this.contentMap.get(uri.toString()) || '';
  }

  isReadonly() {
    return true;
  }

  async updateContent(uri: URI): Promise<any> {
    const sourceFileUri = uri.withScheme(JSON.parse(uri.query).scheme).withoutQuery().withoutFragment();
    const sourceDocModelRef =
      this.documentModelManager.getModelReference(sourceFileUri) ||
      (await this.documentModelManager.createModelReference(sourceFileUri));
    const sourceDocModel = sourceDocModelRef.instance;
    const value = sourceDocModel.getText();
    const replaceViewDocModelRef =
      this.documentModelManager.getModelReference(uri) || (await this.documentModelManager.createModelReference(uri));
    const replaceViewDocModel = replaceViewDocModelRef.instance;

    replaceViewDocModel.updateContent(value);

    let searchResults = this.searchBrowserService.searchResults.get(sourceFileUri.toString());

    if (!searchResults) {
      return '';
    }

    searchResults = searchResults.map((result) =>
      Object.assign({}, result, {
        fileUri: uri.toString(),
      }),
    );

    await replace(
      this.documentModelManager,
      this.workspaceEditService,
      searchResults,
      this.searchBrowserService.replaceValue,
    );

    this.contentMap.set(uri.toString(), replaceViewDocModel.getText());
  }

  onDidChangeContent = this.onDidChangeContentEvent.event;

  delete(uri: URI) {
    this.contentMap.delete(uri.toString());
  }

  clear() {
    this.contentMap.clear();
  }
}

@Injectable()
export class SearchTreeService extends Disposable implements ISearchTreeService {
  private userhomePath: URI | null;

  @Autowired(IContentSearchClientService)
  private readonly searchBrowserService: IContentSearchClientService;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(IEditorDocumentModelContentRegistry)
  private readonly contentRegistry: IEditorDocumentModelContentRegistry;

  @Autowired(ReplaceDocumentModelContentProvider)
  private readonly replaceDocumentModelContentProvider: ReplaceDocumentModelContentProvider;

  @Autowired(RangeHighlightDecorations)
  private readonly rangeHighlightDecorations: RangeHighlightDecorations;

  @Autowired(IFileServiceClient)
  private readonly fileServiceClient: IFileServiceClient;

  @Autowired(SearchContextKey)
  private readonly searchContextKey: SearchContextKey;

  @Autowired(LabelService)
  private readonly labelService: LabelService;

  constructor() {
    super();
    this.addDispose(this.rangeHighlightDecorations);
    this.addDispose(
      this.contentRegistry.registerEditorDocumentModelContentProvider(this.replaceDocumentModelContentProvider),
    );
  }

  get replaceValue() {
    return this.searchBrowserService.replaceValue;
  }

  get resultTotal() {
    return this.searchBrowserService.resultTotal;
  }

  get contextKey() {
    return this.searchContextKey;
  }

  initContextKey(dom: HTMLDivElement) {
    this.contextKey.initScopedContext(dom);
  }

  // @action.bound
  // onContextMenu(files: ISearchTreeItem[], event: React.MouseEvent<HTMLElement>) {
  //   const { x, y } = event.nativeEvent;
  //   const file: ISearchTreeItem = files[0];
  //   if (!file) {
  //     return;
  //   }
  //   const data: any = { id: file.id };
  //   data.file = file;

  //   if (!file.parent) {
  //     data.path = file.uri!.path.toString();
  //   }

  //   if (file.parent) {
  //     this.isContextmenuOnFile = false;
  //   } else {
  //     this.isContextmenuOnFile = true;
  //   }

  //   const menus = this.ctxmenuService.createMenu({
  //     id: MenuId.SearchContext,
  //     config: {
  //       args: [data],
  //     },
  //   });

  //   const menuNodes = menus.getMergedMenuNodes();
  //   menus.dispose();

  //   this.ctxMenuRenderer.show({
  //     anchor: { x, y },
  //     menuNodes,
  //   });
  // }

  // @action.bound
  // async onSelect(files: ISearchTreeItem[]) {
  //   const file: ISearchTreeItem = files[0];

  //   if (!file) {
  //     return;
  //   }

  //   if (!file.parent) {
  //     // Click file name
  //     const newNodes = this._nodes.map((node) => {
  //       if (node.id === file!.id) {
  //         node.expanded = !node.expanded;
  //       }
  //       return node;
  //     });
  //     this.nodes = newNodes;
  //     return;
  //   }

  //   this.lastFocusedNode = file;
  //   this.nodes = this._nodes.map((node) => {
  //     node.selected = node.id === file.id;
  //     node.focused = node.id === file.id;
  //     return node;
  //   });

  //   // Click file result line
  //   const result: ContentSearchResult = file.searchResult!;
  //   const replaceValue = this.searchBrowserService.replaceValue;
  //   const isOpenReplaceView = this.searchPreferences['search.useReplacePreview'];
  //   const now = Number(new Date());
  //   const isPreview = (now - this.lastSelectTime) / 100 > 2; // 200 毫秒 认为双击

  //   this.lastSelectTime = now;

  //   if (isOpenReplaceView && replaceValue.length > 0) {
  //     // Open diff editor
  //     const originalURI = new URI(result.fileUri);
  //     const replaceURI = toReplaceResource(originalURI);

  //     await this.replaceDocumentModelContentProvider.updateContent(replaceURI);

  //     const openResourceResult = await this.workbenchEditorService.open(
  //       URI.from({
  //         scheme: 'diff',
  //         query: URI.stringifyQuery({
  //           name: formatLocalize('search.fileReplaceChanges', originalURI.displayName, replaceURI.displayName),
  //           original: originalURI,
  //           modified: replaceURI,
  //         }),
  //       }),
  //       {
  //         preview: isPreview,
  //       },
  //     );
  //     if (openResourceResult) {
  //       const group = openResourceResult.group;
  //       const editor = group.currentEditor;
  //       if (editor) {
  //         const monaco = editor.monacoEditor;
  //         monaco.revealLineInCenter(result.line);
  //       }
  //     }
  //     this.replaceDocumentModelContentProvider.delete(replaceURI);
  //   } else {
  //     const uri = new URI(result.fileUri);
  //     const openResourceResult = await this.workbenchEditorService.open(new URI(result.fileUri), {
  //       preview: isPreview,
  //       focus: !isPreview,
  //       range: {
  //         startLineNumber: result.line,
  //         startColumn: result.matchStart,
  //         endLineNumber: result.line,
  //         endColumn: result.matchStart + result.matchLength,
  //       },
  //     });

  //     if (openResourceResult && !openResourceResult.resource.deleted) {
  //       this.rangeHighlightDecorations.highlightRange(
  //         uri,
  //         new monaco.Range(result.line, result.matchStart, result.line, result.matchStart + result.matchLength),
  //       );
  //     }
  //   }
  // }

  // @action.bound
  // onBlur() {
  //   if (this.lastFocusedNode) {
  //     this.lastFocusedNode = null;
  //     this.nodes = this._nodes.map((node) => {
  //       node.focused = false;
  //       return node;
  //     });
  //   }
  // }

  // @action.bound
  // foldTree() {
  //   const isExpandAll = (this.searchBrowserService.isExpandAllResult = !this.searchBrowserService.isExpandAllResult);
  //   const newNodes = this._nodes.map((node) => {
  //     node.expanded = isExpandAll;
  //     return node;
  //   });
  //   this.nodes = newNodes;
  // }

  // @action.bound
  // commandActuator(commandId: string, id: string) {
  //   const workspaceEditService = this.workspaceEditService;
  //   const documentModelManager = this.documentModelManager;
  //   const { resultTotal, searchResults, replaceValue } = this.searchBrowserService;
  //   const items = this._nodes;

  //   const methods = {
  //     closeResult() {
  //       const parentId = id.replace(/\?index=\d$/, '');
  //       const matchIndex = id.match(/\d$/);
  //       if (!matchIndex || !parentId) {
  //         return;
  //       }
  //       const index = matchIndex[0];
  //       const oldData = searchResults.get(parentId);
  //       if (!oldData) {
  //         return;
  //       }
  //       if (oldData.length === 1) {
  //         return methods.closeResults(parentId);
  //       }
  //       oldData.splice(Number(index), 1);
  //       resultTotal.resultNum = resultTotal.resultNum - 1;
  //     },
  //     replaceResult() {
  //       const select: ISearchTreeItem | undefined = items.find((v) => v.id === id);
  //       if (!select) {
  //         return;
  //       }
  //       const resultMap: Map<string, ContentSearchResult[]> = new Map();
  //       resultMap.set(select.parent!.uri!.toString(), [select!.searchResult!]);
  //       replaceAll(documentModelManager, workspaceEditService, resultMap, replaceValue).then(() => {
  //         // 结果树更新由 search.service.watchDocModelContentChange 负责
  //       });
  //     },
  //     closeResults(insertId?: string) {
  //       const parentId = insertId || id.replace(/\?index=\d$/, '');
  //       if (!parentId) {
  //         return;
  //       }
  //       const oldData = searchResults.get(parentId);
  //       resultTotal.fileNum = resultTotal.fileNum - 1;
  //       resultTotal.resultNum = resultTotal.resultNum - oldData!.length;
  //       searchResults.delete(parentId);
  //     },
  //     replaceResults: async () => {
  //       const select: ISearchTreeItem | undefined = items.find((v) => v.id === id);
  //       if (!select) {
  //         return;
  //       }
  //       const resultMap: Map<string, ContentSearchResult[]> = new Map();
  //       const contentSearchResult: ContentSearchResult[] = select!.children!.map((child) => child.searchResult!);
  //       const buttons = {
  //         [localize('ButtonCancel')]: false,
  //         [localize('search.replace.buttonOK')]: true,
  //       };
  //       const selection = await this.dialogService.open(
  //         formatLocalize('search.removeAll.occurrences.file.confirmation.message', String(contentSearchResult.length)),
  //         MessageType.Warning,
  //         Object.keys(buttons),
  //       );
  //       if (!buttons[selection!]) {
  //         return buttons[selection!];
  //       }
  //       resultMap.set(select!.fileUri, contentSearchResult);
  //       replaceAll(documentModelManager, workspaceEditService, resultMap, replaceValue).then(() => {
  //         // 结果树更新由 search.service.watchDocModelContentChange 负责
  //       });
  //     },
  //   };

  //   if (!methods[commandId]) {
  //     return;
  //   }
  //   return methods[commandId]();
  // }

  removeHighlightRange() {
    this.rangeHighlightDecorations.removeHighlightRange();
  }

  async resolveChildren(parent?: SearchRoot | SearchFileNode) {
    if (!parent) {
      const root = new SearchRoot(this);
      return [root];
    } else if (parent) {
      if (SearchRoot.isRoot(parent)) {
        const files = this.searchBrowserService.searchResults;
        if (!files) {
          return [];
        }
        const childs: SearchFileNode[] = [];
        for (const filesArray of files) {
          const uri = filesArray[0];
          const resultList = filesArray[1];
          const _uri = new URI(uri);
          const description = await this.workspaceService.asRelativePath(_uri.parent);
          if (!resultList || resultList.length < 1) {
            continue;
          }
          childs.push(
            new SearchFileNode(
              this,
              resultList,
              description,
              await this.getReadableTooltip(_uri),
              this.labelService.getIcon(_uri),
              _uri,
              parent,
            ),
          );
        }
        return childs;
      } else {
        const contentResults = (parent as SearchFileNode).contentResults;
        return contentResults.map((content) => {
          const start = (content.renderStart || content.matchStart) - 1;
          const end = start + content.matchLength;
          const description = content.renderLineText || content.lineText;
          return new SearchContentNode(
            this,
            content,
            description,
            { start, end },
            (parent as SearchFileNode).resource,
            parent as SearchFileNode,
          );
        });
      }
    }
  }

  @memoize
  private async getCurrentUserHome() {
    if (!this.userhomePath) {
      try {
        const userhome = await this.fileServiceClient.getCurrentUserHome();
        if (userhome) {
          this.userhomePath = new URI(userhome.uri);
        }
      } catch (err) {}
    }
    return this.userhomePath;
  }

  private async getReadableTooltip(path: URI) {
    const pathStr = path.toString();
    const userhomePath = await this.getCurrentUserHome();
    if (!userhomePath) {
      return decodeURIComponent(path.withScheme('').toString());
    }
    if (userhomePath.isEqualOrParent(path)) {
      const userhomePathStr = userhomePath && userhomePath.toString();
      return decodeURIComponent(pathStr.replace(userhomePathStr, '~'));
    }
    return decodeURIComponent(path.withScheme('').toString());
  }
}
