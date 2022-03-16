import { IChange, Command } from '@opensumi/ide-core-common';
// eslint-disable-next-line import/no-restricted-paths
import type { ICodeEditor as IMonacoCodeEditor, IPosition } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';

export interface IDirtyDiffModel {
  changes: IChange[];
  findNextClosestChangeLineNumber(lineNumber: number, inclusive?: boolean): number;
  findPreviousClosestChangeLineNumber(lineNumber: number, inclusive?: boolean): number;
}

export const IDirtyDiffWorkbenchController = Symbol('DirtyDiffWorkbenchController');
export interface IDirtyDiffWorkbenchController {
  toggleDirtyDiffWidget(codeEditor: IMonacoCodeEditor, position: IPosition): void;
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
