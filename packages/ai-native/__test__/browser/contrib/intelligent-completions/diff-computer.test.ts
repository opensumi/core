import { MultiLineDiffComputer } from '@opensumi/ide-ai-native/lib/browser/contrib/intelligent-completions/diff-computer';

describe('MultiLineDiffComputer', () => {
  let diffComputer: MultiLineDiffComputer;

  beforeEach(() => {
    diffComputer = new MultiLineDiffComputer();
  });

  test('equals method should return true for equal strings', () => {
    expect(diffComputer['equals']('a', 'a')).toBe(true);
  });

  test('equals method should return false for different strings', () => {
    expect(diffComputer['equals']('a', 'b')).toBe(false);
  });

  test('extractCommon method should find common elements', () => {
    const element = { newPos: 0, changeResult: [] };
    const modified = ['a', 'b', 'c'];
    const original = ['a', 'b', 'c'];
    const diagonal = 0;

    const result = diffComputer['extractCommon'](element, modified, original, diagonal);
    expect(result).toBe(2);
    expect(element.newPos).toBe(2);
    expect(element.changeResult).toEqual([{ count: 2, value: '' }]);
  });

  test('diff method should return undefined for no differences', () => {
    const originalContent = 'a\nb\nc';
    const modifiedContent = 'a\nb\nc';
    const result = diffComputer.diff(originalContent, modifiedContent);
    expect(Array.isArray(result)).toBeTruthy();
    expect(result).toStrictEqual([{ value: modifiedContent, count: modifiedContent.length }]);
  });

  test('diff method should detect all lines added', () => {
    const originalContent = '';
    const modifiedContent = 'a\nb\nc';
    const result = diffComputer.diff(originalContent, modifiedContent);
    expect(result).toEqual([{ added: true, count: modifiedContent.length, value: modifiedContent }]);
  });

  test('diff method should detect all lines removed', () => {
    const originalContent = 'a\nb\nc';
    const modifiedContent = '';
    const result = diffComputer.diff(originalContent, modifiedContent);
    expect(result).toEqual([{ removed: true, count: originalContent.length, value: originalContent }]);
  });

  test('diff method should detect some lines added and some removed', () => {
    const originalContent = 'a\nb\nc';
    const modifiedContent = 'a\nx\nc';
    const result = diffComputer.diff(originalContent, modifiedContent);
    expect(result).toEqual([
      { count: 2, value: 'a\n' },
      { added: undefined, removed: true, count: 1, value: 'b' },
      { added: true, removed: undefined, count: 1, value: 'x' },
      { count: 2, value: '\nc' },
    ]);
  });

  test('diff method should detect mixed changes', () => {
    const originalContent = 'a\nb\nc\nd';
    const modifiedContent = 'a\nx\nc\ny';
    const result = diffComputer.diff(originalContent, modifiedContent);
    expect(result).toEqual([
      { count: 2, value: 'a\n' },
      { added: undefined, removed: true, count: 1, value: 'b' },
      { added: true, removed: undefined, count: 1, value: 'x' },
      { count: 3, value: '\nc\n' },
      { added: undefined, removed: true, count: 1, value: 'd' },
      { added: true, removed: undefined, count: 1, value: 'y' },
    ]);
  });
});
