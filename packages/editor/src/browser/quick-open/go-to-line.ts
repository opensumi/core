import { Injectable, Autowired } from '@opensumi/di';
import {
  CommandService,
  EDITOR_COMMANDS,
  formatLocalize,
  localize,
  QuickOpenHandler,
  withNullAsUndefined,
} from '@opensumi/ide-core-browser';
import { QuickOpenItem, PrefixQuickOpenService, QuickOpenModel, Mode } from '@opensumi/ide-core-browser/lib/quick-open';
import { Event as MonacoEvent } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import { IRange as IMonacoRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { IEditor as IMonacoCodeEditor } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';
import { AbstractGotoLineQuickAccessProvider } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/quickAccess/gotoLineQuickAccess';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { WorkbenchEditorService } from '../types';

class MonacoGoToLine extends AbstractGotoLineQuickAccessProvider {
  activeTextEditorControl: IMonacoCodeEditor | undefined;
  onDidActiveTextEditorControlChange: MonacoEvent<void>;
  addDeco(editor: IMonacoCodeEditor, range: IMonacoRange) {
    this.addDecorations(editor, range);
  }
  clearDeco(editor: IMonacoCodeEditor) {
    this.clearDecorations(editor);
  }
  goTo(editor: IMonacoCodeEditor, range: IMonacoRange) {
    this.gotoLocation(
      { editor },
      {
        range,
        // 该函数内部实现并没有用到这个属性
        keyMods: {
          alt: false,
          ctrlCmd: false,
        },
      },
    );
  }
}

@Injectable()
export class GoToLineQuickOpenHandler implements QuickOpenHandler {
  readonly prefix: string = ':';
  readonly description: string = localize('quickopen.goToLine.desc');
  protected items: QuickOpenItem[];

  @Autowired(PrefixQuickOpenService)
  protected readonly quickOpenService: PrefixQuickOpenService;

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  quickAccess: MonacoGoToLine;
  savedViewState?: monaco.editor.ICodeEditorViewState;

  constructor() {
    this.quickAccess = new MonacoGoToLine();
  }

  getFirstSelection() {
    const editor = this.workbenchEditorService.currentEditor;
    const selections = editor?.getSelections();
    return selections?.[0];
  }

  getRange(line = 1, col = 1): monaco.IRange {
    return {
      startLineNumber: line,
      endLineNumber: line,
      startColumn: col,
      endColumn: col,
    };
  }

  init() {
    // 保存打开时的状态
    this.savedViewState = withNullAsUndefined(this.workbenchEditorService.currentEditor?.monacoEditor.saveViewState());
  }

  getModel(): QuickOpenModel {
    const editor = this.workbenchEditorService.currentEditor;
    const firstSelection = this.getFirstSelection();
    if (!firstSelection || !editor) {
      return {
        onType: (lookFor: string, acceptor: (items: QuickOpenItem[]) => void) => {
          acceptor([
            new QuickOpenItem({
              label: localize('quickopen.goToLine.notValid'),
              run: () => false,
            }),
          ]);
        },
      };
    }

    const currentLine = firstSelection.positionLineNumber ?? 1;
    const currentCol = firstSelection.positionColumn ?? 1;
    const lineCount = editor.currentDocumentModel?.getMonacoModel()?.getLineCount() ?? 1;

    return {
      onType: (lookFor: string, acceptor: (items: QuickOpenItem[]) => void) => {
        // https://github.com/microsoft/vscode/blob/1498d0f34053f854e75e1364adaca6f99e43de08/src/vs/editor/contrib/quickAccess/browser/gotoLineQuickAccess.ts#L114
        // Support different line-col formats
        const numbers = lookFor
          .split(/,|:|#|：|，/)
          .map((part) => parseInt(part, 10))
          .filter((part) => !isNaN(part));
        const line = numbers[0];
        const col = numbers[1];
        if (line) {
          let label = formatLocalize('quickopen.goToLine.lineInfo', line);
          if (col) {
            label += formatLocalize('quickopen.goToLine.colInfo', col);
          }
          const range = this.getRange(line, col);
          acceptor([
            new QuickOpenItem({
              label,
              run: (mode: Mode) => {
                if (mode === Mode.PREVIEW) {
                  editor.monacoEditor.revealRangeInCenter(range, monaco.editor.ScrollType.Smooth);
                  this.quickAccess.addDeco(editor.monacoEditor, range);
                  return false;
                }
                this.quickAccess.goTo(editor.monacoEditor, range);
                return true;
              },
            }),
          ]);
        } else {
          this.quickAccess.clearDeco(editor.monacoEditor);
          acceptor([
            new QuickOpenItem({
              label: formatLocalize('quickopen.goToLine.defaultMessage', currentLine, currentCol, lineCount),
              run: () => false,
            }),
          ]);
        }
      },
    };
  }

  getOptions() {
    return {};
  }

  onClose(canceled) {
    this.commandService.executeCommand(EDITOR_COMMANDS.FOCUS.id);
    const editor = this.workbenchEditorService.currentEditor;
    if (!editor) {
      return;
    }

    this.quickAccess.clearDeco(editor.monacoEditor);
    if (canceled && this.savedViewState) {
      editor.monacoEditor.restoreViewState(this.savedViewState);
    }
  }
}
