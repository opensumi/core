import { cutShortSearchResult } from '../../src/common/content-search';

describe('The long search results should be cropped', () => {
  test('[0] The result of the content exceeding the length, matchStart did not reach the interception position', () => {
    const result = cutShortSearchResult({
      fileUri: 'file://root.txt',
      matchStart: 10,
      matchLength: 10,
      line: 5,
      lineText:
        'aaaaaaaaaMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });

    expect(result.renderStart).toEqual(10);
    expect(result.renderLineText!.length).toEqual(500);
    expect(result.renderLineText![9]).toEqual('M');
  });

  test('[1] The result of the content exceeding the length, matchStart did not reach the interception position', () => {
    const result = cutShortSearchResult({
      fileUri: 'file://root.txt',
      matchStart: 21,
      matchLength: 10,
      line: 5,
      lineText:
        'aaaaaaaaaaaaaaaaaaaaMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });

    expect(result.renderStart).toEqual(20);
    expect(result.renderLineText!.length).toEqual(500);
  });

  test('The matchStart and matchLength reaches the interception position', () => {
    const result = cutShortSearchResult({
      fileUri: 'file://root.txt',
      matchStart: 21,
      matchLength: 501,
      line: 5,
      lineText:
        'aaaaaaaaaaaaaaaaaaaaMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });

    expect(result.renderStart).toEqual(20);
    expect(result.renderLineText!.length).toEqual(500);
    expect(result.matchLength).toEqual(500);
  });

  test('[0] Content does not exceed length', () => {
    const insertResult = {
      fileUri: 'file://root.txt',
      matchStart: 21,
      matchLength: 5,
      line: 5,
      lineText: 'aaaaaaaaaaaaaaaaaaaaMaaaaaaaaaaaaaaa',
    };
    const result = cutShortSearchResult(insertResult);

    expect(result.renderStart).toEqual(insertResult.matchStart);
    expect(result.renderLineText).toEqual(insertResult.lineText);
    expect(result.matchLength).toEqual(insertResult.matchLength);
  });

  test('[1] Content does not exceed length', () => {
    const insertResult = {
      fileUri: 'file://root.txt',
      matchStart: 41,
      matchLength: 5,
      line: 5,
      lineText: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaMaaaaaaaaaaaaaaa',
    };
    const result = cutShortSearchResult(insertResult);

    expect(result.renderStart).toEqual(insertResult.matchStart - 1);
    expect(result.renderLineText).toEqual(insertResult.lineText.slice(1, insertResult.lineText.length));
    expect(result.matchLength).toEqual(insertResult.matchLength);
  });
});
