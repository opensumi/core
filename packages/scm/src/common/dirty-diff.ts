import { IChange } from '@ali/ide-editor';
import { Command } from '@ali/ide-core-common';

export interface IDirtyDiffModel {
  changes: IChange[];
  findNextClosestChange(lineNumber: number, inclusive?: boolean): number;
  findNextClosestChangeLineNumber(lineNumber: number, inclusive?: boolean): number;
  findPreviousClosestChange(lineNumber: number, inclusive?: boolean): number;
  findPreviousClosestChangeLineNumber(lineNumber: number, inclusive?: boolean): number;
}

export const IDirtyDiffWorkbenchController = Symbol('DirtyDiffWorkbenchController');
export interface IDirtyDiffWorkbenchController {
  openDirtyDiffWidget(codeEditor: monaco.editor.ICodeEditor, position: monaco.IPosition): void;
}

export const OPEN_DIRTY_DIFF_WIDGET: Command = {
  id: 'OPEN_DIRTY_DIFF_WIDGET',
};
