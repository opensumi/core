import { LibroService } from '@difizen/libro-core';
import { ViewManager, getOrigin, inject, singleton } from '@difizen/mana-app';

import { Injector } from '@opensumi/di';
import { Event, MonacoService } from '@opensumi/ide-core-browser';
import { uuid } from '@opensumi/ide-utils';
import { IModelService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/model';
import { StandaloneServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';

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
    const aistudioLibroVersionView = await this.viewManager.getOrCreateView<AIStudioLibroVersionView>(
      AIStudioLibroVersionView,
      {
        ...(options || {}),
      },
    );
    // 如果存在原始和目标uri，则创建diff视图，默认为预览视图（git uri）
    if (options.originalUri && options.targetUri) {
      this.viewManager
        .getOrCreateView(LibroDiffView, {
          id: uuid(),
          origin: options.originalUri,
          target: options.targetUri,
        })
        .then((diffView) => {
          aistudioLibroVersionView.libroDiffView = diffView;
          aistudioLibroVersionView.isDiff = true;
        });
      return aistudioLibroVersionView;
    }
    const libroView = await this.libroService.getOrCreateView({
      ...(options || {}),
    });
    // 版本预览视图只读
    libroView.model.inputEditable = false;
    libroView.model.cellsEditable = false;
    libroView.headerRender = () => null;
    aistudioLibroVersionView.libro = libroView;
    return aistudioLibroVersionView;
  }

  createPreviewEditor(content: string, language: string, dom: HTMLElement, diffType: DiffType) {
    const monacoService: MonacoService = this.opensumiInjector.get(MonacoService);
    const editor = getOrigin(monacoService).createCodeEditor(dom, {
      language,
      minimap: {
        enabled: false,
      },
      value: content,
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
      renderFinalNewline: 'off',
      renderLineHighlight: 'none',
      readOnly: true,
      // scrollBeyondLastColumn: 2,
      extraEditorClassName: `libro-diff-editor-${diffType}`,
    });
    return editor;
  }

  createDiffEditor(original: string, modified: string, language: string, dom: HTMLElement) {
    const monacoService: MonacoService = this.opensumiInjector.get(MonacoService);
    const editor = getOrigin(monacoService).createDiffEditor(dom, {
      minimap: {
        enabled: false,
      },
      automaticLayout: false,
      renderSideBySide: true,
      useInlineViewWhenSpaceIsLimited: false,
      fontSize: 13,
      folding: true,
      wordWrap: 'off',
      renderIndicators: false,
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
      scrollBeyondLastColumn: 1,
      renderFinalNewline: 'off',
      renderOverviewRuler: false,
      renderLineHighlight: 'none',
      enableSplitViewResizing: false,
      lineDecorationsWidth: '16px',
      diffWordWrap: 'off',
      readOnly: true,
      extraEditorClassName: 'libro-diff-editor-changed',
    });
    const modelService = StandaloneServices.get(IModelService);
    editor.setModel({
      original: modelService.createModel(original, { languageId: language, onDidChange: Event.None }),
      modified: modelService.createModel(modified, { languageId: language, onDidChange: Event.None }),
    });
    return editor;
  }
}
