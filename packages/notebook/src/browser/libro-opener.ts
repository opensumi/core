import { IPosition as LibroPosition, IRange as LibroRange } from '@difizen/libro-code-editor';
import { CellUri, EditorCellView, ExecutableNotebookModel } from '@difizen/libro-jupyter/noeditor';

import { Autowired, Injectable } from '@opensumi/di';
import { IOpener, IPosition, IRange, URI } from '@opensumi/ide-core-browser';
import { notebookCellScheme } from '@opensumi/ide-editor';

import { LibroOpensumiService } from './libro.service';

export const toEditorRange = (range: IRange): LibroRange => ({
    start: {
      line: range.startLineNumber - 1,
      column: range.startColumn - 1,
    },
    end: {
      line: range.endLineNumber - 1,
      column: range.endColumn - 1,
    },
  });

export const toMonacoPosition = (position: IPosition | undefined): LibroPosition => {
  if (!position) {
    return {
      column: 0,
      line: 0,
    };
  }
  return {
    column: position?.column - 1,
    line: position?.lineNumber - 1,
  };
};

@Injectable()
export class LibroOpener implements IOpener {
  // @Autowired(ResourceService)
  // resourceService: ResourceService;

  // @Autowired(WorkbenchEditorService)
  // workbenchEditorService: WorkbenchEditorService;
  @Autowired(LibroOpensumiService)
  libroOpensumiService: LibroOpensumiService;

  async open(uri: URI) {
    let range: IRange | undefined;
    const match = /^L?(\d+)(?:,(\d+))?/.exec(uri.fragment);
    if (match) {
      // support file:///some/file.js#73,84
      // support file:///some/file.js#L73
      const startLineNumber = parseInt(match[1], 10);
      const startColumn = match[2] ? parseInt(match[2], 10) : 1;
      range = {
        startLineNumber,
        startColumn,
        endLineNumber: startLineNumber,
        endColumn: startColumn,
      };
    }
    await this.openCell(uri, range);
    return true;
  }

  protected async openCell(uri: URI, range?: IRange) {
    const notebookUri = URI.file(uri.path.toString());
    const libroView = await this.libroOpensumiService.getOrCreatLibroView(notebookUri);

    if (!libroView) {
      return false;
    }

    const cell = libroView.model.cells.find((item) => (
        ExecutableNotebookModel.is(libroView.model) &&
        CellUri.from(libroView.model.filePath, item.model.id).toString() === decodeURIComponent(uri.toString())
      ));

    if (!EditorCellView.is(cell)) {
      return;
    }

    libroView.selectCell(cell);
    let line = 0;
    if (range) {
      cell.editor?.focus();
      cell.editor?.revealSelection(toEditorRange(range));
      cell.editor?.setCursorPosition(toEditorRange(range).start);
      line = toEditorRange(range).start.line;
    }
    libroView.model.scrollToView(cell, (line ?? 0) * 20);
  }

  handleScheme(scheme: string) {
    // 使用 handleURI 后会忽略 handleScheme
    return scheme === notebookCellScheme;
  }
}
