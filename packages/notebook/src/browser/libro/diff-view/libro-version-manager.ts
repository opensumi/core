import { LibroService } from '@difizen/libro-core';
import { ViewManager, getOrigin, inject, singleton } from '@difizen/mana-app';

import { Injector } from '@opensumi/di';
import { EditorCollectionService } from '@opensumi/ide-editor';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import { URI, uuid } from '@opensumi/ide-utils';

import { OpensumiInjector } from '../../mana';

import { DiffType } from './libro-diff-protocol';
import { LibroDiffView } from './libro-diff-view';
import { AIStudioLibroVersionView } from './libro-version-view';

import type { NotebookOption } from '@difizen/libro-core';

@singleton()
export class LibroVersionManager {
  protected readonly libroService: LibroService;
  protected readonly viewManager: ViewManager;
  protected readonly opensumiInjector: Injector;
  constructor(
    @inject(LibroService) libroService: LibroService,
    @inject(ViewManager) viewManager: ViewManager,
    @inject(OpensumiInjector) opensumiInjector: Injector,
  ) {
    this.libroService = libroService;
    this.viewManager = viewManager;
    this.opensumiInjector = opensumiInjector;
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
    this.viewManager
      .getOrCreateView(LibroDiffView, {
        id: uuid(),
        origin: options.originalUri,
        target: options.targetUri,
      })
      .then((diffView) => {
        aistudioLibroVersionView.libroDiffView = diffView;
      });
    return aistudioLibroVersionViewPromise;
  }

  async createPreviewEditor(uri: URI, language: string, dom: HTMLElement, diffType: DiffType) {
    const editorCollectionService: EditorCollectionService = this.opensumiInjector.get(EditorCollectionService);
    const docModelService: IEditorDocumentModelService = this.opensumiInjector.get(IEditorDocumentModelService);
    const modelRef = await getOrigin(docModelService).createModelReference(uri, 'libro-opensumi-editor');
    const editor = getOrigin(editorCollectionService).createCodeEditor(dom, {
      language,
      minimap: {
        enabled: false,
      },
      automaticLayout: false,
      folding: true,
      wordWrap: 'off',
      lineDecorationsWidth: 0,
      lineNumbersMinChars: 3,
      scrollbar: {
        vertical: 'hidden',
        alwaysConsumeMouseWheel: false,
        verticalScrollbarSize: 0,
        horizontal: 'visible',
        horizontalScrollbarSize: 0,
      },
      glyphMargin: true,
      scrollBeyondLastLine: false,
      renderFinalNewline: false,
      renderLineHighlight: 'none',
      readOnly: true,
      // scrollBeyondLastColumn: 2,
      extraEditorClassName: `libro-diff-editor-${diffType}`,
    });
    editor.open(modelRef);
    return editor;
  }
}
