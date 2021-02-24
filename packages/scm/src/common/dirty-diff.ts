import * as monaco from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import { IChange, Command } from '@ali/ide-core-common';

export interface IDirtyDiffModel {
  changes: IChange[];
  findNextClosestChangeLineNumber(lineNumber: number, inclusive?: boolean): number;
  findPreviousClosestChangeLineNumber(lineNumber: number, inclusive?: boolean): number;
}

export const IDirtyDiffWorkbenchController = Symbol('DirtyDiffWorkbenchController');
export interface IDirtyDiffWorkbenchController {
  toggleDirtyDiffWidget(codeEditor: monaco.editor.ICodeEditor, position: monaco.IPosition): void;
}

export const OPEN_DIRTY_DIFF_WIDGET: Command = {
  id: 'OPEN_DIRTY_DIFF_WIDGET',
};

export const GOTO_NEXT_CHANGE: Command = {
  id: 'workbench.action.compareEditor.nextChange',
};

export const GOTO_PREVIOUS_CHANGE: Command = {
  id: 'workbench.action.compareEditor.previousChange',
};
