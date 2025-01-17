import { LibroService } from '@difizen/libro-core';
import { ViewManager, inject, singleton } from '@difizen/mana-app';

import { AIStudioLibroVersionView } from './libro-version-view';

import type { NotebookOption } from '@difizen/libro-core';
import { LibroDiffView } from './libro-diff-view';
import { uuid } from '@opensumi/ide-utils';

@singleton()
export class LibroVersionManager {
  protected readonly libroService: LibroService;
  protected readonly viewManager: ViewManager;

  constructor(@inject(LibroService) libroService: LibroService, @inject(ViewManager) viewManager: ViewManager) {
    this.libroService = libroService;
    this.viewManager = viewManager;
  }

  async getOrCreateView(options: NotebookOption): Promise<AIStudioLibroVersionView> {
    const libroView = await this.libroService.getOrCreateView({
      ...(options || {}),
    });
    // 版本预览视图只读
    libroView.model.inputEditable = false;
    libroView.headerRender = () => null;
    const aistudioLibroVersionViewPromise = this.viewManager.getOrCreateView<AIStudioLibroVersionView>(
      AIStudioLibroVersionView,
      {
        ...(options || {}),
      },
    );
    const aistudioLibroVersionView = await aistudioLibroVersionViewPromise;
    aistudioLibroVersionView.libro = libroView;
    this.viewManager.getOrCreateView(LibroDiffView, {
      id: uuid(),
      origin: options.originalUri,
      target: options.targetUri,
    }).then(diffView => {
      aistudioLibroVersionView.libroDiffView = diffView;
    });
    return aistudioLibroVersionViewPromise;
  }
}
