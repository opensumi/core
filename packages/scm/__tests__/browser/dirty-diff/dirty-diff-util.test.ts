import { ILineChange } from '@opensumi/ide-core-common/lib/types/editor';

import { compareChanges, getModifiedEndLineNumber } from '../../../src/browser/dirty-diff/dirty-diff-util';

describe('test for browser/dirty-diff/dirty-diff-util.ts', () => {
  it('compareChanges', () => {
    const change0: ILineChange = [
      10,
      12,
      111,
      2,
      [],
    ];
    const change1: ILineChange = [
      3,
      12,
      110,
      0,
      [],
    ];
    expect(compareChanges(change0, change1)).toBe(1);

    change1[2] = 111;
    expect(compareChanges(change0, change1)).toBe(2);

    change1[3] = 2;
    expect(compareChanges(change0, change1)).toBe(7);

    change1[0] = 10;
    expect(compareChanges(change0, change1)).toBe(0);
  });

  it('getModifiedEndLineNumber', () => {
    const change0: ILineChange = [
      0,
      110,
      110,
      0,
      [],
    ];
    expect(getModifiedEndLineNumber(change0)).toBe(110);

    const change1: ILineChange = [
      0,
      0,
      110,
      2,
      [],
    ];
    expect(getModifiedEndLineNumber(change1)).toBe(2);
  });
});
