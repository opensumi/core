import path from 'path';

import { CancellationTokenSource } from '@opensumi/ide-core-common';
import { FileUri, URI, AppConfig, INodeLogger, NodeLogger } from '@opensumi/ide-core-node';
import { createNodeInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { LogServiceModule } from '@opensumi/ide-logs/lib/node';
import { ProcessModule } from '@opensumi/ide-process';

import { FileSearchModule, IFileSearchService } from '../../src';

describe('search-service', () => {
  const injector = createNodeInjector([FileSearchModule, ProcessModule, LogServiceModule]);
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
  const service = injector.get(IFileSearchService);

  it('shall fuzzy search this spec file', async () => {
    const rootUri = FileUri.create(path.resolve(__dirname, './')).toString();
    const matches = await service.find('test', { rootUris: [rootUri] });
    const expectedFile = FileUri.create(__filename).displayName;
    const testFile = matches.find((e) => e.endsWith(expectedFile));
    expect(testFile).toBeDefined();
  });

  it.skip('shall respect nested .gitignore', async () => {
    const rootUri = FileUri.create(path.resolve(__dirname, '../test-resources')).toString();
    const matches = await service.find('foo', { rootUris: [rootUri], fuzzyMatch: false });

    expect(matches.find((match) => match.endsWith('subdir1/sub-bar/foo.txt'))).toBeUndefined();
    expect(matches.find((match) => match.endsWith('subdir1/sub2/foo.txt'))).toBeDefined();
    expect(matches.find((match) => match.endsWith('subdir1/foo.txt'))).toBeDefined();
  });

  it('shall cancel searches', async () => {
    const rootUri = FileUri.create(path.resolve(__dirname, '../../../../..')).toString();
    const cancelTokenSource = new CancellationTokenSource();
    cancelTokenSource.cancel();
    const matches = await service.find('foo', { rootUris: [rootUri], fuzzyMatch: false }, cancelTokenSource.token);

    expect(matches && matches.length).toBe(0);
  });

  it('should perform file search across all folders in the workspace', async () => {
    const dirA = FileUri.create(path.resolve(__dirname, '../test-resources/subdir1/sub-bar')).toString();
    const dirB = FileUri.create(path.resolve(__dirname, '../test-resources/subdir1/sub2')).toString();

    const matches = await service.find('foo', { rootUris: [dirA, dirB] });
    expect(matches).toBeDefined();
    expect(matches.length).toBe(2);
  });

  describe('search with glob', () => {
    it('should support file searches with globs', async () => {
      const rootUri = FileUri.create(path.resolve(__dirname, '../test-resources/subdir1/sub2')).toString();

      const matches = await service.find('', { rootUris: [rootUri], includePatterns: ['**/*oo.*'] });
      expect(matches).toBeDefined();
      expect(matches.length).toEqual(1);
    });

    it('should NOT support file searches with globs without the prefixed or trailing star (*)', async () => {
      const rootUri = FileUri.create(path.resolve(__dirname, '../test-resources/subdir1/sub2')).toString();

      const trailingMatches = await service.find('', { rootUris: [rootUri], includePatterns: ['*oo'] });
      expect(trailingMatches).toBeDefined();
      expect(trailingMatches.length).toEqual(0);

      const prefixedMatches = await service.find('', { rootUris: [rootUri], includePatterns: ['oo*'] });
      expect(prefixedMatches).toBeDefined();
      expect(prefixedMatches.length).toEqual(0);
    });
  });

  describe('search with ignored patterns', () => {
    it('should NOT ignore strings passed through the search options', async () => {
      const rootUri = FileUri.create(path.resolve(__dirname, '../test-resources/subdir1/sub2')).toString();

      const matches = await service.find('', {
        rootUris: [rootUri],
        includePatterns: ['**/*oo.*'],
        excludePatterns: ['foo'],
      });
      expect(matches).toBeDefined();
      expect(matches.length).toEqual(1);
    });

    const ignoreGlobsUri = FileUri.create(path.resolve(__dirname, '../test-resources/subdir1/sub2')).toString();
    it('should ignore globs passed through the search options #1', () =>
      assertIgnoreGlobs({
        rootUris: [ignoreGlobsUri],
        includePatterns: ['**/*oo.*'],
        excludePatterns: ['*fo*'],
      }));

    it('should ignore globs passed through the search options #2', () =>
      assertIgnoreGlobs({
        rootOptions: {
          [ignoreGlobsUri]: {
            includePatterns: ['**/*oo.*'],
            excludePatterns: ['*fo*'],
          },
        },
      }));

    it('should ignore globs passed through the search options #3', () =>
      assertIgnoreGlobs({
        rootOptions: {
          [ignoreGlobsUri]: {
            includePatterns: ['**/*oo.*'],
          },
        },
        excludePatterns: ['*fo*'],
      }));

    it('should ignore globs passed through the search options #4', () =>
      assertIgnoreGlobs({
        rootOptions: {
          [ignoreGlobsUri]: {
            excludePatterns: ['*fo*'],
          },
        },
        includePatterns: ['**/*oo.*'],
      }));
    it('should ignore globs passed through the search options #5', () =>
      assertIgnoreGlobs({
        rootOptions: {
          [ignoreGlobsUri]: {},
        },
        excludePatterns: ['*fo*'],
        includePatterns: ['**/*oo.*'],
      }));

    async function assertIgnoreGlobs(options: any): Promise<void> {
      const matches = await service.find('', options);
      expect(matches).toBeDefined();
      expect(matches.length).toEqual(0);
    }
  });

  describe('irrelevant absolute results', () => {
    const rootUri = FileUri.create(path.resolve(__dirname, '../test-resources/subdir1/'));
    const searchPattern = 'oox';

    it('not fuzzy', async () => {
      const matches = await service.find(searchPattern, {
        rootUris: [rootUri.toString()],
        fuzzyMatch: false,
        useGitIgnore: true,
        limit: 200,
      });
      expect(matches.length).toBe(0);
    });

    it('fuzzy', async () => {
      const matches = await service.find(searchPattern, {
        rootUris: [rootUri.toString()],
        fuzzyMatch: true,
        useGitIgnore: true,
        limit: 200,
      });
      for (const match of matches) {
        const relativeUri = rootUri.relative(new URI(match));
        expect(relativeUri !== undefined).toBe(true);
        const relativeMatch = relativeUri!.toString();
        let position = 0;
        for (const ch of searchPattern) {
          position = relativeMatch.indexOf(ch, position);
          expect(position !== -1).toBe(true);
        }
      }
    });
  });
});
