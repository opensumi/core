import type { ICodeEditor as IMonacoCodeEditor } from '@ali/ide-monaco/lib/browser/monaco-api/types';
export const DebugEditor = Symbol('DebugEditor');
export type DebugEditor =  IMonacoCodeEditor;
