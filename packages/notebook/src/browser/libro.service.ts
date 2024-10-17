import { LibroService, LibroView } from '@difizen/libro-jupyter/noeditor';
import { Container } from '@difizen/mana-app';
import { makeObservable } from 'mobx';

import { Autowired, Injectable } from '@opensumi/di';
import { URI, WithEventBus } from '@opensumi/ide-core-browser';
import { ResourceDecorationNeedChangeEvent, WorkbenchEditorService } from '@opensumi/ide-editor';

import { LibroTracker } from './libro.view.tracker';
import { ManaContainer } from './mana/index';

export const ILibroOpensumiService = Symbol('ILibroOpensumiService');

// eslint-disable-next-line @typescript-eslint/no-redeclare
export interface ILibroOpensumiService {
  // manaContainer: Container;
  libroTrackerMap: Map<string, LibroTracker>;
  // editorService: WorkbenchEditorService;
  getOrCreatLibroView: (uri: URI) => Promise<LibroView>;
  updateDirtyStatus: (uri: URI, dirty: boolean) => void;
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

  getOrCreatLibroView = async (uri: URI) => {
    const libroOption = {
      modelId: uri.toString(),
      resource: uri.toString(),
      loadType: 'libro-opensumi-loader',
    };
    const libroService = this.manaContainer.get(LibroService);
    const libroView = await libroService.getOrCreateView(libroOption);
    return libroView;
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
