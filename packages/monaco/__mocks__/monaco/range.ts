import { IRange } from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { partialMock } from './common/util';

export function createMockedMonacoRangeApi(): typeof monaco.Range {
  class MockedMonacoRange {
    constructor(
      public startLineNumber: number,
      public startColumn: number,
      public endLineNumber: number,
      public endColumn: number,
    ) {}
    // lift(range: undefined | null): null;
    // lift(range: monaco.IRange): monaco.Range;
    static lift(range?: monaco.IRange | null): any {
      if (!range) {
        return null;
      }

      return range as monaco.Range;
    }

    static areIntersecting(a: IRange, b: IRange) {
      // Check if `a` is before `b`
      if (
        a.endLineNumber < b.startLineNumber ||
        (a.endLineNumber === b.startLineNumber && a.endColumn <= b.startColumn)
      ) {
        return false;
      }

      // Check if `b` is before `a`
      if (
        b.endLineNumber < a.startLineNumber ||
        (b.endLineNumber === a.startLineNumber && b.endColumn <= a.startColumn)
      ) {
        return false;
      }

      // These ranges must intersect
      return true;
    }
  }
  const mockedMonacoRangeApi: any = MockedMonacoRange;

  return partialMock('monaco.Range', mockedMonacoRangeApi);
}
