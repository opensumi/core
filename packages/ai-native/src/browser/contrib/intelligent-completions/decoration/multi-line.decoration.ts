import { isUndefined } from '@opensumi/ide-core-common';
import { ICodeEditor, IModelDeltaDecoration, IPosition, Position, Range } from '@opensumi/ide-monaco';
import { empty } from '@opensumi/ide-utils/lib/strings';
import { EditOperation } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/editOperation';
import { LineDecoration } from '@opensumi/monaco-editor-core/esm/vs/editor/common/viewLayout/lineDecorations';

import { EnhanceDecorationsCollection } from '../../../model/enhanceDecorationsCollection';
import { IMultiLineDiffChangeResult } from '../diff-computer';

export interface IModificationsInline {
  newValue: string;
  oldValue: string;
  lineNumber?: number;
  column?: number;
  isEolLine?: boolean;
  lockLineGhostText?: boolean;
}

enum EProcessStatus {
  beginning = 'beginning',
  end = 'end',
}

interface IProcessModificationsInline extends IModificationsInline {
  status: EProcessStatus;
}

interface IModificationsMap {
  content: string;
  decorations: LineDecoration[];
}

export interface IModificationsInlineAndMap {
  fullLineMods: { [key: number]: IModificationsMap[] };
  inlineMods: IModificationsInline[];
}

// https://github.com/microsoft/vscode/blob/main/src/vs/editor/contrib/inlineCompletions/browser/ghostTextWidget.ts#L156
export const GHOST_TEXT_DESCRIPTION = 'ghost-text-decoration';
export const GHOST_TEXT = 'ghost-text';

export class MultiLineDecorationModel {
  private ghostTextDecorations: EnhanceDecorationsCollection;

  constructor(private readonly editor: ICodeEditor) {
    this.ghostTextDecorations = new EnhanceDecorationsCollection(this.editor);
  }

  /**
   * 切割 diff 计算结果的换行符
   */
  private splitDiffChanges(lines: IMultiLineDiffChangeResult[], eol: string): IMultiLineDiffChangeResult[] {
    const modifiedLines = lines.flatMap((line) => {
      const segments = line.value.split(eol);
      const wrap = (value: string): IMultiLineDiffChangeResult => ({ value, added: line.added, removed: line.removed });

      return segments
        .flatMap((segment, index) => {
          if (index < segments.length - 1) {
            return [wrap(segment), wrap(eol)];
          }

          return wrap(segment);
        })
        .filter((line) => line.value !== empty);
    });

    // 对处理后的结果进行调整，确保相邻的添加和删除操作合并
    for (let i = 0; i < modifiedLines.length - 1; i++) {
      const currentLine = modifiedLines[i];
      const nextLine = modifiedLines[i + 1];
      // 如果当前行是删除操作，下一行是添加操作，并且下一行的值以当前行的值开头，则合并这两个操作
      if (currentLine.removed && nextLine.added && nextLine.value.startsWith(currentLine.value)) {
        currentLine.added = true;
        currentLine.removed = true;
      }
    }

    return modifiedLines;
  }

  /**
   * 合并连续的修改操作
   */
  private combineContinuousMods(changes: IModificationsInline[]) {
    const lines: string[] = [];
    let currentLineContent = empty;
    for (const change of changes) {
      if (change.isEolLine) {
        lines.push(currentLineContent);
        currentLineContent = empty;
      } else {
        currentLineContent += change.newValue;
      }
    }
    if (currentLineContent !== empty) {
      lines.push(currentLineContent);
    }
    return lines;
  }

  private processLineModifications(
    waitAddModificationsLines: IModificationsInline[],
    eol: string,
    previous: IMultiLineDiffChangeResult,
    next?: IMultiLineDiffChangeResult,
    includeInline = true,
  ) {
    const lines = this.combineContinuousMods(waitAddModificationsLines);
    const len = lines.length;

    const fullLineMods: string[] = [];
    const inlineMods: IProcessModificationsInline[] = [];

    if (len === 0) {
      return {
        fullLineMods,
        inlineMods,
      };
    }

    const firstLine = lines[0];
    const lastLine = lines[len - 1];

    if (len === 1) {
      if (includeInline) {
        if (!isUndefined(previous) && previous.value !== eol) {
          inlineMods.push({
            status: EProcessStatus.beginning,
            newValue: previous.value + firstLine,
            oldValue: previous.value,
          });
        } else if (!isUndefined(next) && next.value !== eol) {
          inlineMods.push({
            status: EProcessStatus.end,
            newValue: lastLine + next.value,
            oldValue: next.value,
          });
        } else {
          fullLineMods.push(firstLine);
        }
      } else {
        fullLineMods.push(firstLine);
      }

      return {
        fullLineMods,
        inlineMods,
      };
    }

    if (isUndefined(previous) || previous.value === eol) {
      fullLineMods.push(firstLine);
    } else {
      inlineMods.push({
        status: EProcessStatus.beginning,
        newValue: previous.value + firstLine,
        oldValue: previous.value,
      });
    }

    if (len > 2) {
      const middleLines = lines.slice(1, -1);
      for (const line of middleLines) {
        fullLineMods.push(line);
      }
    }

    if (isUndefined(next) || next.value === eol) {
      fullLineMods.push(lastLine);
    } else {
      inlineMods.push({
        status: EProcessStatus.end,
        newValue: lastLine + next.value,
        oldValue: next.value,
      });
    }

    return {
      fullLineMods,
      inlineMods,
    };
  }

  private getEdits() {
    const decorations = this.ghostTextDecorations.getDecorations();
    const edits = decorations.map(({ editorDecoration, range }) => {
      const options = editorDecoration.options;
      const text = options.after?.content || '';

      return { range, text };
    });

    return edits;
  }

  public clearDecorations(): void {
    this.ghostTextDecorations.clear();
  }

  public updateLineModificationDecorations(modifications: IModificationsInline[]) {
    if (modifications.length === 0) {
      this.clearDecorations();
      return;
    }

    const decorations: IModelDeltaDecoration[] = modifications.map((modification) => {
      let content: string;

      if (modification.newValue.startsWith(modification.oldValue)) {
        content = modification.newValue.slice(modification.oldValue.length);
      } else {
        const oldValueIndex = modification.newValue.indexOf(modification.oldValue);
        content = oldValueIndex !== -1 ? modification.newValue.slice(0, oldValueIndex) : modification.newValue;
      }

      return {
        range: Range.fromPositions(new Position(modification.lineNumber!, modification.column!)),
        options: {
          description: GHOST_TEXT,
          showIfCollapsed: true,
          after: {
            content,
            inlineClassName: GHOST_TEXT_DESCRIPTION,
          },
        },
      };
    });

    this.ghostTextDecorations.set(decorations);
  }

  public applyInlineDecorations(
    editor: ICodeEditor,
    changes: IMultiLineDiffChangeResult[],
    startLine: number,
    cursorPosition: IPosition,
  ): IModificationsInlineAndMap | undefined {
    const model = editor.getModel();
    if (!model) {
      return;
    }

    const eol = model.getEOL();

    changes = this.splitDiffChanges(changes, eol);
    changes.unshift({
      value: eol,
      added: undefined,
      removed: undefined,
    });

    let currentLine = Math.max(startLine - 1, 0);
    const baseText = model.getValue();
    const currentLineText = model.getLineContent(cursorPosition.lineNumber);

    const modificationsMap: { [key: number]: IModificationsMap[] } = {};
    const resultModifications: IModificationsInline[] = [];

    let previousValue = empty;
    let isEmptyLine = currentLineText.trim() === empty;
    let lastChange: IMultiLineDiffChangeResult;
    let waitAddModificationsLines: IModificationsInline[] = [];
    let currentLineIndex = currentLine;
    let columnNumber = 1;

    const processChange = (change: IMultiLineDiffChangeResult | undefined) => {
      const isUniqueLine = !resultModifications.some(
        (modification) => modification.lineNumber === currentLine && modification.lockLineGhostText,
      );

      const { fullLineMods, inlineMods } = this.processLineModifications(
        waitAddModificationsLines,
        eol,
        lastChange,
        change,
        isUniqueLine,
      );

      modificationsMap[currentLine] = [
        ...(modificationsMap[currentLine] ?? []),
        ...fullLineMods.map((value) => ({
          content: value,
          decorations: [new LineDecoration(1, value.length + 1, 'ghost-text', 0)],
        })),
      ];

      inlineMods.forEach((mod) =>
        resultModifications.push({
          lineNumber: mod.status === EProcessStatus.beginning ? currentLine : currentLine + 1,
          column: mod.status === EProcessStatus.beginning ? columnNumber : 1,
          newValue: mod.newValue,
          oldValue: mod.oldValue,
        }),
      );

      return {
        fullLineMods,
        inlineMods,
      };
    };

    for (const change of changes) {
      if (change.added) {
        const isEolLine = change.value === eol;

        if (isEolLine) {
          previousValue = empty;
        }

        waitAddModificationsLines.push({
          isEolLine,
          lineNumber: currentLine,
          newValue: isEolLine ? empty : change.value,
          oldValue: isEolLine ? empty : previousValue,
        });
      } else {
        const { inlineMods } = processChange(change);

        if (modificationsMap[currentLine].length > 0 && baseText.split(eol)[currentLine] === empty) {
          const mods = modificationsMap[currentLine];
          if (mods.length > 0) {
            const firstModContent = mods[0].content;
            const remainingMods = mods.slice(1);

            if (firstModContent.startsWith(currentLineText)) {
              if (!resultModifications.some((mod) => mod.lineNumber === currentLine + 1 && mod.lockLineGhostText)) {
                resultModifications.push({
                  lineNumber: currentLine + 1,
                  column: 1,
                  newValue: firstModContent,
                  oldValue: empty,
                  lockLineGhostText: true,
                });
                modificationsMap[currentLine + 1] ??= [];
                modificationsMap[currentLine + 1].unshift(...remainingMods);
              } else {
                modificationsMap[currentLine + 1] ??= [];
                modificationsMap[currentLine + 1].unshift(...mods);
              }

              modificationsMap[currentLine] = [];
            }
          }
        }

        if (currentLine === cursorPosition.lineNumber && inlineMods.length > 0) {
          isEmptyLine = false;

          if (
            (currentLine < cursorPosition.lineNumber && modificationsMap[currentLine]?.length > 0) ||
            (currentLine === cursorPosition.lineNumber && inlineMods.length > 0 && columnNumber < cursorPosition.column)
          ) {
            return;
          }
        }

        lastChange = change;
        waitAddModificationsLines = [];

        // 如果 change 的值是 eol，则开启新的一行进行计算
        if (change.value === eol) {
          currentLineIndex++;
          columnNumber = 1;
          previousValue = empty;
        } else if (currentLineIndex > currentLine) {
          currentLine = currentLineIndex;
          columnNumber += change.value.length;
          waitAddModificationsLines = [];
          previousValue += change.value;
        } else {
          columnNumber += change.value.length;
          previousValue += change.value;
        }
      }
    }

    const { fullLineMods } = processChange(undefined);

    if (isEmptyLine) {
      const modsAtCursorLine = modificationsMap[cursorPosition.lineNumber - 1];
      if (modsAtCursorLine?.length > 0) {
        const firstModContent = modsAtCursorLine[0].content;
        const remainingMods = modsAtCursorLine.slice(1);

        if (!resultModifications.some((mod) => mod.lineNumber === cursorPosition.lineNumber && mod.lockLineGhostText)) {
          resultModifications.push({
            lineNumber: cursorPosition.lineNumber,
            column: cursorPosition.column,
            newValue: firstModContent.slice(cursorPosition.column - 1),
            oldValue: currentLineText,
            lockLineGhostText: true,
          });
          modificationsMap[cursorPosition.lineNumber] ??= [];
          modificationsMap[cursorPosition.lineNumber].unshift(...remainingMods);
        } else {
          modificationsMap[cursorPosition.lineNumber] ??= [];
          modificationsMap[cursorPosition.lineNumber].unshift(...modsAtCursorLine);
        }

        modificationsMap[cursorPosition.lineNumber - 1] = [];
      }
    } else if (currentLine < cursorPosition.lineNumber && fullLineMods.length > 0) {
      return;
    }

    return {
      fullLineMods: modificationsMap,
      inlineMods: resultModifications,
    };
  }

  public accept() {
    const edits = this.getEdits();

    if (edits.length === 0) {
      return;
    }

    this.editor.pushUndoStop();
    this.editor.executeEdits(
      'multiLineCompletions.accept',
      edits.map((edit) =>
        EditOperation.insert(
          Position.lift({ lineNumber: edit.range.startLineNumber, column: edit.range.startColumn }),
          edit.text,
        ),
      ),
    );
  }
}
