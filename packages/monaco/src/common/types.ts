export type { Position, IPosition } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/position';
export { ITextModel, EndOfLineSequence } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
export type { Event } from '@opensumi/monaco-editor-core/esm/vs/base/common/event';
export type { ICodeEditor, IDiffEditor } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
export { Emitter } from '@opensumi/monaco-editor-core/esm/vs/base/common/event';
export {
  LanguageConfiguration,
  FoldingRules,
  IndentationRule,
  IAutoClosingPairConditional,
  IAutoClosingPair,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes/languageConfiguration';
export { CodeActionTriggerType } from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes';

export interface IDisposable {
  dispose(): void;
}

export type IEvent<T> = (listener: (e: T) => any, thisArg?: any) => IDisposable;

/**
 * End of line character preference.
 */
export const enum EOL {
  LF = '\n',

  CRLF = '\r\n',
}
