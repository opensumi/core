import * as monaco from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
export const DebugEditor = Symbol('DebugEditor');
export type DebugEditor =  monaco.editor.ICodeEditor;
