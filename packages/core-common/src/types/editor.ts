/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Some code copued and modified from https://github.com/microsoft/vscode/blob/1.44.0/src/vs/editor/common/core/position.ts

export interface IRange {

  // from 1
  startLineNumber: number,

  // from 1
  startColumn: number,

  endLineNumber: number,

  endColumn: number,

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
	delta(deltaLineNumber: number = 0, deltaColumn: number = 0): Position {
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
		return (
			!!a &&
			!!b &&
			a.lineNumber === b.lineNumber &&
			a.column === b.column
		);
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
		let aLineNumber = a.lineNumber | 0;
		let bLineNumber = b.lineNumber | 0;

		if (aLineNumber === bLineNumber) {
			let aColumn = a.column | 0;
			let bColumn = b.column | 0;
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
		return (
			obj
			&& (typeof obj.lineNumber === 'number')
			&& (typeof obj.column === 'number')
		);
	}
}


export interface IEditOperation {
  range: IRange;
	text: string;
}

export interface IEditorDocumentEditChange {
	changes: IEditOperation[],
}


export interface IEditorDocumentEOLChange {
	eol: '\n' | '\r\n',
}

export type IEditorDocumentChange = IEditorDocumentEditChange | IEditorDocumentEOLChange;

export function isEditChange(change: IEditorDocumentChange): change is IEditorDocumentEditChange {
  return !!(change as IEditorDocumentEditChange).changes;
}

export interface IEditorDocumentModelSaveResult {

  state: 'success' | 'error' | 'diff';

  errorMessage?: string;

}

/**
 * 该类型与 modes.SymbolKind 无法兼容
 * 请使用 `modes.SymbolKind` 替代
 * ```ts
 * import * as modes from '@ali/monaco-editor-core/esm/vs/editor/common/modes';
 * ```
 * @deprecated
 */
export enum SymbolKind {
  File = 0,
  Module = 1,
  Namespace = 2,
  Package = 3,
  Class = 4,
  Method = 5,
  Property = 6,
  Field = 7,
  Constructor = 8,
  Enum = 9,
  Interface = 10,
  Function = 11,
  Variable = 12,
  Constant = 13,
  String = 14,
  Number = 15,
  Boolean = 16,
  Array = 17,
  Object = 18,
  Key = 19,
  Null = 20,
  EnumMember = 21,
  Struct = 22,
  Event = 23,
  Operator = 24,
  TypeParameter = 25,
}

export enum SymbolTag {
  Deprecated = 1
}

/**
 * A change
 */
export interface IChange {
  readonly originalStartLineNumber: number;
  readonly originalEndLineNumber: number;
  readonly modifiedStartLineNumber: number;
  readonly modifiedEndLineNumber: number;
}

/**
 * A character level change.
 */
export interface ICharChange extends IChange {
  readonly originalStartColumn: number;
  readonly originalEndColumn: number;
  readonly modifiedStartColumn: number;
  readonly modifiedEndColumn: number;
}

/**
 * A line change
 */
export interface ILineChange extends IChange {
  readonly charChanges: ICharChange[] | undefined;
}
