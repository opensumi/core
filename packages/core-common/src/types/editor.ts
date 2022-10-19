/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Some code copied and modified from https://github.com/microsoft/vscode/blob/1.44.0/src/vs/editor/common/core/position.ts

import type { ILineChange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/editorWorker';

export interface IRange {
  // from 1
  startLineNumber: number;

  // from 1
  startColumn: number;

  endLineNumber: number;

  endColumn: number;
}

export interface ISelection {
  /**
   * The line number on which the selection has started.
   */
  selectionStartLineNumber: number;
  /**
   * The column on `selectionStartLineNumber` where the selection has started.
   */
  selectionStartColumn: number;
  /**
   * The line number on which the selection has ended.
   */
  positionLineNumber: number;
  /**
   * The column on `positionLineNumber` where the selection has ended.
   */
  positionColumn: number;
}

/**
 * A position in the editor. This interface is suitable for serialization.
 */
export interface IPosition {
  /**
   * line number (starts at 1)
   */
  readonly lineNumber: number;
  /**
   * column (the first character in a line is between column 1 and column 2)
   */
  readonly column: number;
}

/**
 * A position in the editor.
 */
export class Position {
  /**
   * line number (starts at 1)
   */
  public readonly lineNumber: number;
  /**
   * column (the first character in a line is between column 1 and column 2)
   */
  public readonly column: number;

  constructor(lineNumber: number, column: number) {
    this.lineNumber = lineNumber;
    this.column = column;
  }

  /**
   * Create a new postion from this position.
   *
   * @param newLineNumber new line number
   * @param newColumn new column
   */
  with(newLineNumber: number = this.lineNumber, newColumn: number = this.column): Position {
    if (newLineNumber === this.lineNumber && newColumn === this.column) {
      return this;
    } else {
      return new Position(newLineNumber, newColumn);
    }
  }

  /**
   * Derive a new position from this position.
   *
   * @param deltaLineNumber line number delta
   * @param deltaColumn column delta
   */
  delta(deltaLineNumber = 0, deltaColumn = 0): Position {
    return this.with(this.lineNumber + deltaLineNumber, this.column + deltaColumn);
  }

  /**
   * Test if this position equals other position
   */
  public equals(other: IPosition): boolean {
    return Position.equals(this, other);
  }

  /**
   * Test if position `a` equals position `b`
   */
  public static equals(a: IPosition | null, b: IPosition | null): boolean {
    if (!a && !b) {
      return true;
    }
    return !!a && !!b && a.lineNumber === b.lineNumber && a.column === b.column;
  }

  /**
   * Test if this position is before other position.
   * If the two positions are equal, the result will be false.
   */
  public isBefore(other: IPosition): boolean {
    return Position.isBefore(this, other);
  }

  /**
   * Test if position `a` is before position `b`.
   * If the two positions are equal, the result will be false.
   */
  public static isBefore(a: IPosition, b: IPosition): boolean {
    if (a.lineNumber < b.lineNumber) {
      return true;
    }
    if (b.lineNumber < a.lineNumber) {
      return false;
    }
    return a.column < b.column;
  }

  /**
   * Test if this position is before other position.
   * If the two positions are equal, the result will be true.
   */
  public isBeforeOrEqual(other: IPosition): boolean {
    return Position.isBeforeOrEqual(this, other);
  }

  /**
   * Test if position `a` is before position `b`.
   * If the two positions are equal, the result will be true.
   */
  public static isBeforeOrEqual(a: IPosition, b: IPosition): boolean {
    if (a.lineNumber < b.lineNumber) {
      return true;
    }
    if (b.lineNumber < a.lineNumber) {
      return false;
    }
    return a.column <= b.column;
  }

  /**
   * A function that compares positions, useful for sorting
   */
  public static compare(a: IPosition, b: IPosition): number {
    const aLineNumber = a.lineNumber | 0;
    const bLineNumber = b.lineNumber | 0;

    if (aLineNumber === bLineNumber) {
      const aColumn = a.column | 0;
      const bColumn = b.column | 0;
      return aColumn - bColumn;
    }

    return aLineNumber - bLineNumber;
  }

  /**
   * Clone this position.
   */
  public clone(): Position {
    return new Position(this.lineNumber, this.column);
  }

  /**
   * Convert to a human-readable representation.
   */
  public toString(): string {
    return '(' + this.lineNumber + ',' + this.column + ')';
  }

  // ---

  /**
   * Create a `Position` from an `IPosition`.
   */
  public static lift(pos: IPosition): Position {
    return new Position(pos.lineNumber, pos.column);
  }

  /**
   * Test if `obj` is an `IPosition`.
   */
  public static isIPosition(obj: any): obj is IPosition {
    return obj && typeof obj.lineNumber === 'number' && typeof obj.column === 'number';
  }
}

export interface IEditOperation {
  range: IRange;
  text: string;
}

export interface IEditorDocumentEditChange {
  changes: IEditOperation[];
}

export interface IEditorDocumentEOLChange {
  eol: '\n' | '\r\n';
}

export type IEditorDocumentChange = IEditorDocumentEditChange | IEditorDocumentEOLChange;

export function isEditChange(change: IEditorDocumentChange): change is IEditorDocumentEditChange {
  return !!(change as IEditorDocumentEditChange).changes;
}

export const enum SaveTaskErrorCause {
  CANCEL = 'cancel',
  USE_BY_CONTENT = 'useByContent',
}

export enum SaveTaskResponseState {
  ERROR = 'error',
  SUCCESS = 'success',
  DIFF = 'diff',
}

export type EditorDocumentModelSaveResultState = SaveTaskResponseState;

export interface IEditorDocumentModelSaveResult {
  state: EditorDocumentModelSaveResultState;

  errorMessage?: string;
}

export enum SymbolTag {
  Deprecated = 1,
}

export { ILineChange };
