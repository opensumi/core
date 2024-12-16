import { ViewManager } from '@alipay/mana-app';
import { inject, singleton } from '@alipay/mana-syringe';
import type { NotebookOption } from '@alipay/libro-core';
import { LibroService } from '@alipay/libro-core';
import { AIStudioLibroVersionView } from './libro-version-view';

@singleton()
export class LibroVersionManager {
  protected readonly libroService: LibroService;
  protected readonly viewManager: ViewManager;

  constructor(
    @inject(LibroService) libroService: LibroService,
    @inject(ViewManager) viewManager: ViewManager,
  ) {
    this.libroService = libroService;
    this.viewManager = viewManager;
  }

  async getOrCreateView(options: NotebookOption): Promise<AIStudioLibroVersionView> {
    const libroView = await this.libroService.getOrCreateView({
      ...(options || {}),
    });
    libroView.model.readOnly = true;
    const aistudioLibroVersionViewPromise =
      this.viewManager.getOrCreateView<AIStudioLibroVersionView>(AIStudioLibroVersionView, {
        ...(options || {}),
      });
    const aistudioLibroVersionView = await aistudioLibroVersionViewPromise;
    aistudioLibroVersionView.libro = libroView;
    return aistudioLibroVersionViewPromise;
  }
}
