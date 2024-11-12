import { CellUri, CellView, LanguageSpecRegistry, LibroService, LibroView } from '@difizen/libro-jupyter/noeditor';
import { Container, URI as ManaURI, getOrigin } from '@difizen/mana-app';
import { makeObservable } from 'mobx';

import { Autowired, Injectable } from '@opensumi/di';
import { URI, WithEventBus, path } from '@opensumi/ide-core-browser';
import { ResourceDecorationNeedChangeEvent, WorkbenchEditorService } from '@opensumi/ide-editor';

import { LibroTracker } from './libro.view.tracker';
import { ContentLoaderType, ManaContainer } from './mana';

export const ILibroOpensumiService = Symbol('ILibroOpensumiService');

// eslint-disable-next-line @typescript-eslint/no-redeclare
export interface ILibroOpensumiService {
  // manaContainer: Container;
  libroTrackerMap: Map<string, LibroTracker>;
  // editorService: WorkbenchEditorService;
  getOrCreateLibroView: (uri: URI) => Promise<LibroView>;
  updateDirtyStatus: (uri: URI, dirty: boolean) => void;
  getCellViewByUri: (uri: URI) => Promise<CellView | undefined>;
  getCellLanguage: (cell: CellView) => string | undefined;
}

@Injectable()
export class LibroOpensumiService extends WithEventBus implements ILibroOpensumiService {
  @Autowired(ManaContainer)
  private readonly manaContainer: Container;

  @Autowired(WorkbenchEditorService)
  protected readonly editorService: WorkbenchEditorService;

  constructor() {
    super();
    makeObservable(this);
  }

  get libroService() {
    const libroService = this.manaContainer.get(LibroService);
    return libroService;
  }

  getOrCreateLibroView = async (uri: URI) => {
    const libroOption = {
      modelId: uri.toString(),
      resource: uri.toString(),
      loadType: ContentLoaderType,
    };
    return await this.libroService.getOrCreateView(libroOption);
  };

  getCellViewByUri = async (uri: URI) => {
    const parsed = CellUri.parse(new ManaURI(uri.toString(), { simpleMode: false }));
    if (!parsed) {
      return;
    }
    const { notebookId, cellId } = parsed;
    // const notebookUri = URI.file(notebookId);
    /**
     * 这里需要兼容各种不同的 content contribution 加载数据的方式，采取匹配model id的方式来找到libroview， 因为model id是会被编码进uri的
     */
    const libroView = Array.from(this.libroService.getViewCache().values()).find(
      (item) => path.join('/', String(item.model.id)) === notebookId,
    );
    return libroView?.model.cells.find((cell) => cell.model.id === cellId);
  };

  getCellLanguage = (cell: CellView) => {
    const languageSpecRegistry = this.manaContainer.get(LanguageSpecRegistry);
    return getOrigin(languageSpecRegistry.languageSpecs).find((item) => item.mime === cell.model.mimeType)?.language;
  };

  updateDirtyStatus(uri: URI, dirty: boolean) {
    this.eventBus.fire(
      new ResourceDecorationNeedChangeEvent({
        uri,
        decoration: {
          dirty,
        },
      }),
    );
  }

  libroTrackerMap: Map<string, LibroTracker> = new Map();
}
