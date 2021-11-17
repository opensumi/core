import type { ICodeEditor as IMonacoCodeEditor } from '@ide-framework/ide-monaco/lib/browser/monaco-api/types';
export const DebugEditor = Symbol('DebugEditor');
export type DebugEditor =  IMonacoCodeEditor;
