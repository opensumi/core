import { Autowired, Injectable } from '@opensumi/di';
import { LabelService } from '@opensumi/ide-core-browser';
import {
  Deferred,
  Disposable,
  DisposableStore,
  Emitter,
  IDisposable,
  IRange,
  Schemes,
  URI,
  memoize,
} from '@opensumi/ide-core-common';
import {
  IEditorDocumentModelContentProvider,
  IEditorDocumentModelContentRegistry,
  IEditorDocumentModelRef,
  IEditorDocumentModelService,
} from '@opensumi/ide-editor/lib/browser';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';
import * as monaco from '@opensumi/ide-monaco';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { IWorkspaceEditService } from '@opensumi/ide-workspace-edit';

import { IContentSearchClientService, ISearchTreeService } from '../../common/content-search';
import { replace } from '../replace';
import { SearchContextKey } from '../search-contextkey';
import { SearchContentNode, SearchFileNode, SearchRoot } from '../tree/tree-node.defined';

import type { IModelDeltaDecoration } from '@opensumi/ide-monaco/lib/browser/monaco-api/editor';
import type { ITextModel } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';

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

    let searchResults = this.searchBrowserService.searchResults.get(sourceFileUri.toString());

    if (!searchResults) {
      return '';
    }

    const sourceDocModelRef =
      this.documentModelManager.getModelReference(sourceFileUri) ||
      (await this.documentModelManager.createModelReference(sourceFileUri));
    const sourceDocModel = sourceDocModelRef.instance;
    const value = sourceDocModel.getText();
    const replaceViewDocModelRef =
      this.documentModelManager.getModelReference(uri) || (await this.documentModelManager.createModelReference(uri));
    const replaceViewDocModel = replaceViewDocModelRef.instance;

    replaceViewDocModel.updateContent(value);

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
      this.searchBrowserService.searchValue,
      this.searchBrowserService.UIState.isUseRegexp,
    );

    this.contentMap.set(uri.toString(), replaceViewDocModel.getText());

    replaceViewDocModelRef.dispose();
    sourceDocModelRef.dispose();
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
  public readonly searchContextKey: SearchContextKey;

  @Autowired(LabelService)
  private readonly labelService: LabelService;

  private viewReadyDeferered = new Deferred<void>();

  get viewReady() {
    return this.viewReadyDeferered.promise;
  }

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
    this.viewReadyDeferered.resolve();
  }

  removeHighlightRange() {
    this.rangeHighlightDecorations.removeHighlightRange();
  }

  async resolveChildren(
    parent?: SearchRoot | SearchFileNode,
  ): Promise<(SearchRoot | SearchFileNode | SearchContentNode)[]> {
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
          const description = (await this.workspaceService.asRelativePath(_uri.parent))?.path;
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
    return [];
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
