import { CellUri, CellView, LibroJupyterView, LibroService, LibroView, MIME } from '@difizen/libro-jupyter/noeditor';
import { Container, getOrigin } from '@difizen/mana-app';

import { Autowired, Injectable } from '@opensumi/di';
import { URI } from '@opensumi/ide-core-browser';
import { DisposableCollection, Uri } from '@opensumi/ide-core-common';
import {
  CellKind,
  INotebookModelAddedData,
  NotebookCellDto,
  NotebookCellsChangeType,
  NotebookRawContentEventDto,
  WorkbenchEditorService,
} from '@opensumi/ide-editor';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser/doc-model/types';
import { NotebookService } from '@opensumi/ide-editor/lib/browser/notebook.service';

import { LIBRO_COMPONENTS_SCHEME_ID } from './libro.protocol';
import { ILibroOpensumiService } from './libro.service';
import { ManaContainer } from './mana';

@Injectable()
export class NotebookServiceOverride extends NotebookService {
  @Autowired(ManaContainer)
  private readonly manaContainer: Container;
  @Autowired(IEditorDocumentModelService)
  private readonly editorModelService: IEditorDocumentModelService;
  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;
  @Autowired(ILibroOpensumiService)
  private readonly libroOpensumiService: ILibroOpensumiService;

  listenEditor() {
    return this.workbenchEditorService.onActiveResourceChange((e) => {
      if (e?.uri?.path.ext === `.${LIBRO_COMPONENTS_SCHEME_ID}`) {
        this.libroOpensumiService.getOrCreateLibroView(e.uri).then((libroView) => {
          this.handleOpenNotebook(libroView);
        });
      }
    });
  }

  protected notebookVersions = new Map<string, number>();

  protected getNotebookVersion(libroView: LibroView) {
    const uri = this.getNotebookUri(libroView as LibroJupyterView).toString();
    return this.notebookVersions.get(uri) ?? 1;
  }

  protected deleteNotebookVersion(libroView: LibroView) {
    const uri = this.getNotebookUri(libroView as LibroJupyterView).toString();
    return this.notebookVersions.delete(uri);
  }

  protected updateNotebookVersion(libroView: LibroView) {
    const uri = this.getNotebookUri(libroView as LibroJupyterView).toString();
    const versionId = this.notebookVersions.get(uri) ?? 1;
    this.notebookVersions.set(uri, versionId + 1);
  }

  protected isValidNotebook(view: LibroView): boolean {
    if (view instanceof LibroJupyterView) {
      return true;
    }
    return false;
  }

  isCodeCell(mime: string) {
    return ([MIME.odpssql, MIME.python] as string[]).includes(mime);
  }

  getCellURI(cell: CellView) {
    return CellUri.from(cell.parent.model.id, cell.model.id);
  }

  getCellModelRef(cell: CellView) {
    return this.editorModelService.getModelReference(URI.parse(this.getCellURI(cell).toString()));
  }

  asNotebookCell(cell: CellView): NotebookCellDto {
    return {
      cellKind: this.isCodeCell(cell.model.mimeType) ? CellKind.Code : CellKind.Markup,
      eol: '\n',
      handle: 1,
      language: this.libroOpensumiService.getCellLanguage(cell) ?? 'plaintext',
      mime: cell.model.mimeType,
      outputs: [],
      source: cell.model.value.split('\n'),
      uri: Uri.parse(this.getCellURI(cell).toString()),
    };
  }

  getNotebookUri(notebook: LibroJupyterView) {
    return Uri.parse(notebook.model.filePath);
  }

  asNotebook(notebook: LibroJupyterView): INotebookModelAddedData {
    return {
      uri: this.getNotebookUri(notebook),
      viewType: 'jupyter-notebook',
      versionId: this.getNotebookVersion(notebook),
      cells: notebook.model.cells.map((item) => this.asNotebookCell(item)),
    };
  }

  listenLibro() {
    const disposables = new DisposableCollection();
    const libroService = this.manaContainer.get(LibroService);
    disposables.push(libroService.onNotebookViewCreated(this.handleOpenNotebook));
    disposables.push(
      libroService.onNotebookViewClosed((libroView) => {
        if (!this.isValidNotebook(libroView)) {
          return;
        }
        this.deleteNotebookVersion(libroView);
        this._onDidCloseNotebookDocument.fire(this.getNotebookUri(libroView as LibroJupyterView));
      }),
    );
    disposables.push(
      libroService.onNotebookViewSaved((libroView) => {
        if (!this.isValidNotebook(libroView)) {
          return;
        }
        this.updateNotebookVersion(libroView);
        this._onDidSaveNotebookDocument.fire(this.getNotebookUri(libroView as LibroJupyterView));
      }),
    );
    disposables.push(
      libroService.onNotebookViewChanged((event) => {
        if (!this.isValidNotebook(event.libroView)) {
          return;
        }

        if (!event.libroView.model.isInitialized) {
          return;
        }

        const events: NotebookRawContentEventDto[] = [];

        if (event.contentChanges) {
          event.contentChanges.forEach((item) => {
            if (item.addedCells.length > 0) {
              events.push({
                kind: NotebookCellsChangeType.ModelChange,
                changes: [[item.range.start, 0, item.addedCells.map((cell) => this.asNotebookCell(cell))]],
              });
            }
            if (item.removedCells.length > 0) {
              events.push({
                kind: NotebookCellsChangeType.ModelChange,
                changes: [[item.range.start, item.range.end - item.range.start, []]],
              });
            }
          });
        }

        this.updateNotebookVersion(event.libroView);
        this._onDidChangeNotebookDocument.fire({
          uri: this.getNotebookUri(event.libroView as LibroJupyterView),
          event: {
            rawEvents: events,
            versionId: this.getNotebookVersion(event.libroView),
          },
          isDirty: getOrigin(event.libroView.model.dirty),
        });
      }),
    );

    disposables.push(
      libroService.onNotebookCellChanged((event) => {
        const events: NotebookRawContentEventDto[] = [];
        const index = event.cell.parent.findCellIndex(event.cell);
        const modelRef = this.getCellModelRef(event.cell);
        events.push({
          kind: NotebookCellsChangeType.ChangeCellContent,
          index,
        });
        this._onDidChangeNotebookDocument.fire({
          uri: this.getNotebookUri(event.cell.parent as LibroJupyterView),
          event: {
            rawEvents: events,
            versionId: modelRef?.instance.getMonacoModel().getVersionId() ?? 1,
          },
          isDirty: getOrigin(event.cell.parent.model.dirty),
        });
      }),
    );
    return disposables;
  }

  protected handleOpenNotebook = async (libroView: LibroView) => {
    if (!this.isValidNotebook(libroView)) {
      return;
    }
    await libroView.initialized;
    this.updateNotebookVersion(libroView);
    this._onDidOpenNotebookDocument.fire(this.asNotebook(libroView as LibroJupyterView));
  };
}
