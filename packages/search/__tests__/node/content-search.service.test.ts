/**
 * 参考使用 theia 的单测
 */
import fs from 'fs';
import path from 'path';

import temp from 'temp';

import { isWindows } from '@opensumi/ide-core-common';
import { FileUri, AppConfig, INodeLogger, NodeLogger } from '@opensumi/ide-core-node';
import { createNodeInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { LogServiceModule } from '@opensumi/ide-logs/lib/node';
import { ProcessModule } from '@opensumi/ide-process';

import { SearchModule, IContentSearchServer, ContentSearchResult, SEARCH_STATE } from '../../src';

// Allow creating temporary files, but remove them when we are done.
const track = temp.track();

// The root dirs we'll use to test searching.
let rootDirA: string;
let rootDirB: string;
let rootSubdirA: string;
let rootDirAUri: string;
let rootDirBUri: string;
let rootSubdirAUri: string;

// Remember the content of the test files we create, to validate that the
// reported line text is right.
const fileLines: Map<string, string[]> = new Map();

const injector = createNodeInjector([SearchModule, ProcessModule, LogServiceModule]);
injector.addProviders(
  {
    token: AppConfig,
    useValue: {},
  },
  {
    token: INodeLogger,
    useClass: NodeLogger,
  },
);

const contentSearchServer: IContentSearchServer = injector.get(IContentSearchServer);

class MockContentSearchClient {
  results: ContentSearchResult[] = [];
  onDoneCallback: () => void;
  error: string;
  errorId: number;

  constructor(onDoneCallback: () => void) {
    this.onDoneCallback = onDoneCallback;
  }

  onSearchResult(data) {
    const resultList = data.data;

    if (data.searchState === SEARCH_STATE.done) {
      this.onDone(data.id);
    }

    if (data.searchState === SEARCH_STATE.error) {
      this.error = data.error;
      this.errorId = data.id;
      this.onDone(data.id);
    }

    if (!resultList || resultList.length < 1) {
      return;
    }
    this.results = this.results.concat(resultList);
  }

  onDone(searchId: number): void {
    // Sort the results, so that the order is predictable.
    // this.results.sort(ContentSearchResult.compare);
    this.onDoneCallback();
  }
}

// Create a test file relative to rootDir.
function createTestFile(filename: string, text: string): void {
  const dir = getRootPathFromName(filename);
  fs.writeFileSync(path.join(dir, filename), text);
  fileLines.set(filename, text.split('\n'));
}

// Returns the path of the root folder by the file name
const getRootPathFromName = (name: string) => {
  const names: { [file: string]: string } = {
    carrots: rootDirA,
    potatoes: rootDirA,
    pastas: rootDirA,
    regexes: rootDirA,
    small: `${rootDirA}/small`,
    'file:with:some:colons': rootDirA,
    'file with spaces': rootDirA,
    'utf8-file': rootDirA,
    'special shell matchStarts': rootDirA,
    'glob.txt': rootDirA,
    glob: rootDirA,
    'lots-of-matches': rootDirA,
    orange: rootDirB,
    folderSubfolder: rootSubdirA,
  };
  return names[name];
};

beforeAll(() => {
  rootDirA = track.mkdirSync();
  rootDirB = track.mkdirSync();
  rootSubdirA = track.mkdirSync({ dir: rootDirA });
  rootDirAUri = FileUri.create(rootDirA).toString();
  rootDirBUri = FileUri.create(rootDirB).toString();
  rootSubdirAUri = FileUri.create(rootSubdirA).toString();

  createTestFile(
    'carrots',
    `\
This is a carrot.
Most carrots are orange, but some carrots are not.
Once capitalized, the word carrot looks like this: CARROT.
Carrot is a funny word.
`,
  );
  createTestFile(
    'potatoes',
    `\
Potatoes, unlike carrots, are generally not orange.  But sweet potatoes are,
it's very confusing.
`,
  );

  createTestFile('pastas', 'pasta pasta');

  createTestFile(
    'regexes',
    `\
aaa hello. x h3lo y hell0h3lllo
hello1
`,
  );

  fs.mkdirSync(rootDirA + '/small');
  createTestFile('small', 'A small file.\n');

  if (!isWindows) {
    createTestFile(
      'file:with:some:colons',
      `\
Are you looking for this: --foobar?
`,
    );
  }

  createTestFile(
    'file with spaces',
    `\
Are you looking for this: --foobar?
`,
  );

  createTestFile(
    'utf8-file',
    `\
Var är jag?  Varför är jag här?
`,
  );

  createTestFile(
    'special shell matchStarts',
    `\
If one uses \`salut";\' echo foo && echo bar; "\` as a search term it should not be a problem to find here.
`,
  );

  createTestFile(
    'glob.txt',
    `\
test -glob patterns
`,
  );

  createTestFile(
    'glob',
    `\
test --glob patterns
`,
  );

  let lotsOfMatchesText = '';
  for (let i = 0; i < 100000; i++) {
    lotsOfMatchesText += 'lots-of-matches\n';
  }
  createTestFile('lots-of-matches', lotsOfMatchesText);

  createTestFile(
    'orange',
    `\
the oranges' orange looks slightly different from carrots' orange.
`,
  );

  createTestFile('folderSubfolder', 'a file in the subfolder of a folder.');
});

afterAll(() => {
  try {
    track.cleanupSync();
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.log("Couldn't cleanup search-in-workspace temp directory.", ex);
  }
});

function compareSearchResults(expected: ContentSearchResult[], actual: ContentSearchResult[]): void {
  expect(actual.length).toEqual(expected.length);

  if (actual.length !== expected.length) {
    return;
  }

  for (let i = 0; i < actual.length; i++) {
    const e = expected[i];
    const lines = fileLines.get(e.fileUri);
    if (lines) {
      const line = lines[e.line - 1];
      e.lineText = line;
      e.fileUri = FileUri.create(path.join(getRootPathFromName(e.fileUri), e.fileUri)).toString();

      const a: any = actual.find((l) => l.fileUri === e.fileUri && l.line === e.line && l.matchStart === e.matchStart);

      expect(a.fileUri).toEqual(e.fileUri);
      expect(a.line).toEqual(e.line);
      expect(a.matchStart).toEqual(e.matchStart);
      expect(a.matchLength).toEqual(e.matchLength);
      expect(a.lineText).toEqual(e.renderLineText);
    } else {
      // We don't know this file...
      throw new Error('Error');
    }
  }
}

describe('ripgrep-search-in-workspace-server', () => {
  jest.setTimeout(10000);

  it('should return 1 result when searching for " pasta", respecting the leading whitespace', (done) => {
    const pattern = ' pasta';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [
        { fileUri: 'pastas', line: 1, matchStart: 6, matchLength: pattern.length, lineText: '' },
      ];
      compareSearchResults(expected, client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri]);
  });

  it('should return 1 result when searching for "pasta", respecting the trailing whitespace', (done) => {
    const pattern = 'pasta ';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [
        { fileUri: 'pastas', line: 1, matchStart: 1, matchLength: pattern.length, lineText: '' },
      ];
      compareSearchResults(expected, client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri]);
  });

  // Try some simple patterns with different case.
  it('should return 7 results when searching for "carrot"', (done) => {
    const pattern = 'carrot';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [
        { fileUri: 'carrots', line: 1, matchStart: 11, matchLength: pattern.length, lineText: '' },
        { fileUri: 'carrots', line: 2, matchStart: 6, matchLength: pattern.length, lineText: '' },
        { fileUri: 'carrots', line: 2, matchStart: 35, matchLength: pattern.length, lineText: '' },
        { fileUri: 'carrots', line: 3, matchStart: 28, matchLength: pattern.length, lineText: '' },
        { fileUri: 'carrots', line: 3, matchStart: 52, matchLength: pattern.length, lineText: '' },
        { fileUri: 'carrots', line: 4, matchStart: 1, matchLength: pattern.length, lineText: '' },
        { fileUri: 'potatoes', line: 1, matchStart: 18, matchLength: pattern.length, lineText: '' },
      ];
      compareSearchResults(expected, client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri]);
  });

  it('should return 5 results when searching for "carrot" case sensitive', (done) => {
    const pattern = 'carrot';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [
        { fileUri: 'carrots', line: 1, matchStart: 11, matchLength: pattern.length, lineText: '' },
        { fileUri: 'carrots', line: 2, matchStart: 6, matchLength: pattern.length, lineText: '' },
        { fileUri: 'carrots', line: 2, matchStart: 35, matchLength: pattern.length, lineText: '' },
        { fileUri: 'carrots', line: 3, matchStart: 28, matchLength: pattern.length, lineText: '' },
        { fileUri: 'potatoes', line: 1, matchStart: 18, matchLength: pattern.length, lineText: '' },
      ];

      compareSearchResults(expected, client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri], {
      matchCase: true,
    });
  });

  it('should return 4 results when searching for "carrot" matching whole words, case insensitive', (done) => {
    const pattern = 'carrot';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [
        { fileUri: 'carrots', line: 1, matchStart: 11, matchLength: pattern.length, lineText: '' },
        { fileUri: 'carrots', line: 3, matchStart: 28, matchLength: pattern.length, lineText: '' },
        { fileUri: 'carrots', line: 3, matchStart: 52, matchLength: pattern.length, lineText: '' },
        { fileUri: 'carrots', line: 4, matchStart: 1, matchLength: pattern.length, lineText: '' },
      ];

      compareSearchResults(expected, client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri], {
      matchWholeWord: true,
    });
  });

  it('should return 4 results when searching for "carrot" matching whole words, case sensitive', (done) => {
    const pattern = 'carrot';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [
        { fileUri: 'carrots', line: 1, matchStart: 11, matchLength: pattern.length, lineText: '' },
        { fileUri: 'carrots', line: 3, matchStart: 28, matchLength: pattern.length, lineText: '' },
      ];

      compareSearchResults(expected, client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri], {
      matchWholeWord: true,
      matchCase: true,
    });
  });

  it('should return 1 result when searching for "Carrot"', (done) => {
    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [
        { fileUri: 'carrots', line: 4, matchStart: 1, matchLength: 6, lineText: '' },
      ];

      compareSearchResults(expected, client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search('Carrot', [rootDirAUri], { matchCase: true });
  });

  it('should return 0 result when searching for "CarroT"', (done) => {
    const pattern = 'CarroT';

    const client = new MockContentSearchClient(() => {
      compareSearchResults([], client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri], { matchCase: true });
  });

  // Try something that we know isn't there.
  it('should find 0 result when searching for "PINEAPPLE"', (done) => {
    const pattern = 'PINEAPPLE';

    const client = new MockContentSearchClient(() => {
      compareSearchResults([], client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri]);
  });

  // Try a pattern with a space.
  it('should find 1 result when searching for "carrots are orange"', (done) => {
    const pattern = 'carrots are orange';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [
        { fileUri: 'carrots', line: 2, matchStart: 6, matchLength: pattern.length, lineText: '' },
      ];

      compareSearchResults(expected, client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri]);
  });

  // Try with an output size that exceeds the default node buffer size
  // (200 * 1024) when spawning a new process.
  it('should work with a lot of results', (done) => {
    // This can take a bit of time.
    jest.setTimeout(150000);
    const pattern = 'lots-of-matches';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [];

      for (let i = 1; i <= 100; i++) {
        expected.push({
          fileUri: 'lots-of-matches',
          line: i,
          matchStart: 1,
          matchLength: pattern.length,
          lineText: '',
        });
      }

      compareSearchResults(expected, client.results);
      done();
    });

    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri]);
  });

  // Try limiting the number of returned results.
  it('should limit the number of returned results', (done) => {
    const pattern = 'lots-of-matches';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [];

      for (let i = 1; i <= 100; i++) {
        expected.push({
          fileUri: 'lots-of-matches',
          line: i,
          matchStart: 1,
          matchLength: pattern.length,
          lineText: '',
        });
      }

      compareSearchResults(expected, client.results);
      done();
    });

    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri], {
      maxResults: 1000,
    });
  });

  // Try with regexes.
  it('should search for regexes', (done) => {
    const pattern = 'h[e3]l+[o0]';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [
        { fileUri: 'regexes', line: 1, matchStart: 5, matchLength: 5, lineText: '' },
        { fileUri: 'regexes', line: 1, matchStart: 14, matchLength: 4, lineText: '' },
        { fileUri: 'regexes', line: 1, matchStart: 21, matchLength: 5, lineText: '' },
        { fileUri: 'regexes', line: 1, matchStart: 26, matchLength: 6, lineText: '' },
        { fileUri: 'regexes', line: 2, matchStart: 1, matchLength: 5, lineText: '' },
      ];

      compareSearchResults(expected, client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri], {
      useRegExp: true,
    });
  });

  // Try without regex
  it('should search for fixed string', (done) => {
    const pattern = 'hello.';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [
        { fileUri: 'regexes', line: 1, matchStart: 5, matchLength: 6, lineText: '' },
      ];

      compareSearchResults(expected, client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri], {
      useRegExp: false,
    });
  });

  // Try with a pattern starting with -, and in filenames containing colons and spaces.
  it('should search a pattern starting with -', (done) => {
    const pattern = '-fo+bar';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [
        { fileUri: 'file with spaces', line: 1, matchStart: 28, matchLength: 7, lineText: '' },
      ];

      if (!isWindows) {
        expected.push({ fileUri: 'file:with:some:colons', line: 1, matchStart: 28, matchLength: 7, lineText: '' });
      }

      compareSearchResults(expected, client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri], { useRegExp: true });
  });

  // Try with a pattern starting with --, and in filenames containing colons and spaces.
  it('should search a pattern starting with --', (done) => {
    const pattern = '--fo+bar';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [
        { fileUri: 'file with spaces', line: 1, matchStart: 27, matchLength: 8, lineText: '' },
      ];

      if (!isWindows) {
        expected.push({ fileUri: 'file:with:some:colons', line: 1, matchStart: 27, matchLength: 8, lineText: '' });
      }

      compareSearchResults(expected, client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri], { useRegExp: true });
  });

  it('should search a pattern starting with a dash w/o regex', (done) => {
    const pattern = '-foobar';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [
        { fileUri: 'file with spaces', line: 1, matchStart: 28, matchLength: 7, lineText: '' },
      ];

      if (!isWindows) {
        expected.push({ fileUri: 'file:with:some:colons', line: 1, matchStart: 28, matchLength: 7, lineText: '' });
      }

      compareSearchResults(expected, client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri]);
  });

  it('should search a pattern starting with two dashes w/o regex', (done) => {
    const pattern = '--foobar';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [
        { fileUri: 'file with spaces', line: 1, matchStart: 27, matchLength: 8, lineText: '' },
      ];

      if (!isWindows) {
        expected.push({ fileUri: 'file:with:some:colons', line: 1, matchStart: 27, matchLength: 8, lineText: '' });
      }

      compareSearchResults(expected, client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri]);
  });

  it('should search a whole pattern starting with - w/o regex', (done) => {
    const pattern = '-glob';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [
        { fileUri: 'glob', line: 1, matchStart: 7, matchLength: 5, lineText: '' },
        { fileUri: 'glob.txt', line: 1, matchStart: 6, matchLength: 5, lineText: '' },
      ];

      compareSearchResults(expected, client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri], { matchWholeWord: true });
  });

  it('should search a whole pattern starting with -- w/o regex', (done) => {
    const pattern = '--glob';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [
        { fileUri: 'glob', line: 1, matchStart: 6, matchLength: 6, lineText: '' },
      ];

      compareSearchResults(expected, client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri], { matchWholeWord: true });
  });

  it('should search a pattern in .txt file', (done) => {
    const pattern = '-glob';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [
        { fileUri: 'glob.txt', line: 1, matchStart: 6, matchLength: 5, lineText: '' },
      ];

      compareSearchResults(expected, client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri], { include: ['*.txt'] });
  });

  it('should search a whole pattern in .txt file', (done) => {
    const pattern = '-glob';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [
        { fileUri: 'glob.txt', line: 1, matchStart: 6, matchLength: 5, lineText: '' },
      ];

      compareSearchResults(expected, client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri], { include: ['*.txt'], matchWholeWord: true });
  });

  // Try searching in an UTF-8 file.
  it('should search in a UTF-8 file', (done) => {
    const pattern = ' jag';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [
        { fileUri: 'utf8-file', line: 1, matchStart: 7, matchLength: 4, lineText: '' },
        { fileUri: 'utf8-file', line: 1, matchStart: 23, matchLength: 4, lineText: '' },
      ];

      compareSearchResults(expected, client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri]);
  });

  // Try searching a pattern that contains unicode matchStarts.
  it('should search a UTF-8 pattern', (done) => {
    const pattern = ' h?är';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [
        { fileUri: 'utf8-file', line: 1, matchStart: 4, matchLength: 3, lineText: '' },
        { fileUri: 'utf8-file', line: 1, matchStart: 20, matchLength: 3, lineText: '' },
        { fileUri: 'utf8-file', line: 1, matchStart: 27, matchLength: 4, lineText: '' },
      ];

      compareSearchResults(expected, client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri], { useRegExp: true });
  });

  // A regex that may match an empty string should not return zero-length
  // results.  Run the test in a directory without big files, because it
  // makes rg print all searched lines, which can take a lot of time.
  it('should not return zero-length matches', (done) => {
    const pattern = '(hello)?';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [];

      compareSearchResults(expected, client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri + '/small']);
  });

  it('should search a pattern with special matchStarts ', (done) => {
    const pattern = 'salut";\' echo foo && echo bar; "';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [
        { fileUri: 'special shell matchStarts', line: 1, matchStart: 14, matchLength: 32, lineText: '' },
      ];

      compareSearchResults(expected, client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri], { useRegExp: true });
  });

  it('should find patterns across all directories', (done) => {
    const pattern = 'carrot';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [
        { fileUri: 'orange', line: 1, matchStart: 51, matchLength: pattern.length, lineText: '' },
        { fileUri: 'carrots', line: 1, matchStart: 11, matchLength: pattern.length, lineText: '' },
        { fileUri: 'carrots', line: 2, matchStart: 6, matchLength: pattern.length, lineText: '' },
        { fileUri: 'carrots', line: 2, matchStart: 35, matchLength: pattern.length, lineText: '' },
        { fileUri: 'carrots', line: 3, matchStart: 28, matchLength: pattern.length, lineText: '' },
        { fileUri: 'carrots', line: 3, matchStart: 52, matchLength: pattern.length, lineText: '' },
        { fileUri: 'carrots', line: 4, matchStart: 1, matchLength: pattern.length, lineText: '' },
        { fileUri: 'potatoes', line: 1, matchStart: 18, matchLength: pattern.length, lineText: '' },
      ];

      compareSearchResults(expected, client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri, rootDirBUri]);
  });

  it('should only find patterns from the folder closest to the file', (done) => {
    const pattern = 'folder';

    const client = new MockContentSearchClient(() => {
      const expected: ContentSearchResult[] = [
        { fileUri: 'folderSubfolder', line: 1, matchStart: 18, matchLength: pattern.length, lineText: '' },
        { fileUri: 'folderSubfolder', line: 1, matchStart: 30, matchLength: pattern.length, lineText: '' },
        { fileUri: 'folderSubfolder', line: 1, matchStart: 18, matchLength: pattern.length, lineText: '' },
        { fileUri: 'folderSubfolder', line: 1, matchStart: 30, matchLength: pattern.length, lineText: '' },
      ];

      compareSearchResults(expected, client.results);
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    contentSearchServer.search(pattern, [rootDirAUri, rootSubdirAUri]);
  });

  it('出错时可以正常抛出', async (done): Promise<void> => {
    const errorMessage = 'A error!';
    const id = 9;

    const client = new MockContentSearchClient(() => {
      done();
    });
    (contentSearchServer as any).rpcClient = [client];
    (contentSearchServer as any).searchError(id, errorMessage);
    expect(client.error).toEqual(errorMessage);
    expect(client.errorId).toEqual(id);
  });
});
