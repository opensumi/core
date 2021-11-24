import type { IPosition, IRange } from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

/**
 * position 转换 range
 * @param position
 */
export function positionToRange(position: IPosition | number): IRange {
  if (typeof position === 'number') {
    return {
      startLineNumber: position,
      endLineNumber: position,
      startColumn: 1,
      endColumn: 1,
    };
  } else {
    const { lineNumber } = position;
    return {
      startLineNumber: lineNumber,
      endLineNumber: lineNumber,
      startColumn: 1,
      endColumn: 1,
    };
  }
}
