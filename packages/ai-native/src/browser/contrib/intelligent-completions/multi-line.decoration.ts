import { isUndefined } from '@opensumi/ide-core-common';
import {
  ICodeEditor,
  IEditorDecorationsCollection,
  IModelDeltaDecoration,
  IPosition,
  Position,
  Range,
} from '@opensumi/ide-monaco';
import { empty } from '@opensumi/ide-utils/lib/strings';

import { IDiffChangeResult } from './diff-computer';

interface IModificationsInline {
  newValue: string;
  oldValue: string;
  lineNumber?: number;
  column?: number;
  isEolLine?: boolean;
}

enum EProcessStatus {
  beginning = 'beginning',
  end = 'end',
}

interface IProcessModificationsInline extends IModificationsInline {
  status: EProcessStatus;
}

// https://github.com/microsoft/vscode/blob/main/src/vs/editor/contrib/inlineCompletions/browser/ghostTextWidget.ts#L156
const GHOST_TEXT_DESCRIPTION = 'ghost-text-decoration';
const GHOST_TEXT = 'ghost-text';

export class MultiLineDecorationModel {
  private ghostTextDecorations: IEditorDecorationsCollection;

  constructor(private readonly editor: ICodeEditor) {
    this.ghostTextDecorations = this.editor.createDecorationsCollection();
  }

  /**
   * 切割 diff 计算结果的换行符
   */
  private splitDiffChanges(lines: IDiffChangeResult[], eol: string): IDiffChangeResult[] {
    const modifiedLines = lines.flatMap((line) => {
      const segments = line.value.split(eol);
      const wrap = (value: string): IDiffChangeResult => ({ value, added: line.added, removed: line.removed });

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
    previous: IDiffChangeResult,
    next?: IDiffChangeResult,
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
    changes: IDiffChangeResult[],
    startLine: number,
    cursorPosition: IPosition,
  ): IModificationsInline[] | undefined {
    startLine = Math.max(startLine - 1, 0);

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

    const currentLineText = model.getLineContent(cursorPosition.lineNumber);
    const resultModifications: IModificationsInline[] = [];

    let lastChange: IDiffChangeResult;
    let waitAddModificationsLines: IModificationsInline[] = [];
    let columnNumber = 1;

    const processChange = (change: IDiffChangeResult | undefined) => {
      const { fullLineMods, inlineMods } = this.processLineModifications(
        waitAddModificationsLines,
        eol,
        lastChange,
        change,
      );

      inlineMods.forEach((mod) =>
        resultModifications.push({
          lineNumber: mod.status === EProcessStatus.beginning ? startLine : startLine + 1,
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

    let currentLineIndex = startLine;
    let previousValue = empty;
    let isEmptyLine = currentLineText.trim() === empty;

    for (const change of changes) {
      if (change.added) {
        const isEolLine = change.value === eol;

        if (isEolLine) {
          previousValue = empty;
        }

        waitAddModificationsLines.push({
          isEolLine,
          lineNumber: startLine,
          newValue: isEolLine ? empty : change.value,
          oldValue: isEolLine ? empty : previousValue,
        });
      } else {
        const { inlineMods } = processChange(change);

        if (startLine === cursorPosition.lineNumber && inlineMods.length > 0) {
          isEmptyLine = false;

          /**
           * 如果光标位置在首个 diff 结果的后面，则不显示多行补全
           */
          if (startLine < cursorPosition.lineNumber && columnNumber < cursorPosition.column) {
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
        } else {
          startLine = Math.max(startLine, currentLineIndex);
          columnNumber += change.value.length;
          previousValue += change.value;
        }
      }
    }

    const { fullLineMods } = processChange(undefined);

    if (!isEmptyLine && startLine < cursorPosition.lineNumber && fullLineMods.length > 0) {
      return;
    }

    return resultModifications;
  }
}
