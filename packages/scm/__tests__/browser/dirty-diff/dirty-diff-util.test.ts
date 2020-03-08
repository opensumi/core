import { compareChanges, getModifiedEndLineNumber } from '../../../src/browser/dirty-diff/dirty-diff-util';

describe('test for browser/dirty-diff/dirty-diff-util.ts', () => {
  it('compareChanges', () => {
    const change0 = {
      originalStartLineNumber: 10,
      originalEndLineNumber: 12,
      modifiedStartLineNumber: 111,
      modifiedEndLineNumber: 2,
    };
    const change1 = {
      originalStartLineNumber: 3,
      originalEndLineNumber: 12,
      modifiedStartLineNumber: 110,
      modifiedEndLineNumber: 0,
    };
    expect(compareChanges(change0, change1)).toBe(1);

    change1.modifiedStartLineNumber = 111;
    expect(compareChanges(change0, change1)).toBe(2);

    change1.modifiedEndLineNumber = 2;
    expect(compareChanges(change0, change1)).toBe(7);

    change1.originalStartLineNumber = 10;
    expect(compareChanges(change0, change1)).toBe(0);
  });

  it('getModifiedEndLineNumber', () => {
    const change0 = {
      originalStartLineNumber: 0,
      originalEndLineNumber: 110,
      modifiedStartLineNumber: 110,
      modifiedEndLineNumber: 0,
    };
    expect(getModifiedEndLineNumber(change0)).toBe(110);

    const change1 = {
      originalStartLineNumber: 0,
      originalEndLineNumber: 0,
      modifiedStartLineNumber: 110,
      modifiedEndLineNumber: 2,
    };
    expect(getModifiedEndLineNumber(change1)).toBe(2);
  });
});
