/**
 * WebMCP group definition for IDE-backed search operations.
 */
import { Injector } from '@opensumi/di';
import { getValidateInput } from '@opensumi/ide-addons/lib/browser/file-search.contribution';
import { CancellationToken, CancellationTokenSource, URI } from '@opensumi/ide-core-common';
import { defaultFilesWatcherExcludes } from '@opensumi/ide-core-common/lib/preferences/file-watch';
import { ILanguageService } from '@opensumi/ide-editor/lib/common/language';
import { FileSearchServicePath, IFileSearchService } from '@opensumi/ide-file-search/lib/common';
import { ContentSearchClientService } from '@opensumi/ide-search/lib/browser/search.service';
import { ContentSearchResult, IContentSearchClientService, SEARCH_STATE } from '@opensumi/ide-search/lib/common';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { WebMcpGroupRegistration } from '../webmcp-group-registry';
import { classifyError, errorResult, serviceUnavailableResult, successResult, tryGetService } from '../webmcp-utils';

const DEFAULT_FILE_RESULTS = 20;
const MAX_FILE_RESULTS = 100;
const DEFAULT_TEXT_RESULTS = 50;
const MAX_TEXT_RESULTS = 200;
const SEARCH_TIMEOUT_MS = 10_000;

function getWorkspaceRootPaths(workspaceService: IWorkspaceService): string[] {
  return workspaceService.tryGetRoots().map((root) => URI.parse(root.uri).codeUri.fsPath);
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function toPositiveCappedNumber(value: unknown, fallback: number, cap: number): number {
  return Math.min(Math.max(Number(value) || fallback, 1), cap);
}

function waitForSearchDone(
  searchService: ContentSearchClientService,
  timeoutMs: number,
): Promise<{ timedOut: boolean }> {
  return new Promise((resolve) => {
    let settled = false;
    let disposable: { dispose(): void } | undefined;

    const finish = (timedOut: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      disposable?.dispose();
      clearTimeout(timer);
      resolve({ timedOut });
    };

    const timer = setTimeout(() => finish(true), timeoutMs);
    disposable = searchService.onDidChange(() => {
      if (!searchService.isSearching) {
        finish(false);
      }
    });

    if (!searchService.isSearching) {
      finish(false);
    }
  });
}

function flattenSearchResults(searchResults: Map<string, ContentSearchResult[]>, maxResults: number) {
  const results = Array.from(searchResults.entries()).flatMap(([fileUri, matches]) => {
    const path = URI.parse(fileUri).codeUri.fsPath;
    return matches.map((match) => ({
      uri: fileUri,
      path,
      line: match.line,
      matchStart: match.matchStart,
      matchLength: match.matchLength,
      lineText: match.lineText ?? match.renderLineText ?? '',
    }));
  });
  return results.slice(0, maxResults);
}

export function createSearchGroup(container: Injector): WebMcpGroupRegistration {
  return {
    name: 'search',
    description: 'Workspace file, text, and symbol search',
    defaultLoaded: true,
    tools: [
      {
        name: 'search_files',
        description:
          'Search workspace files by fuzzy filename or path. Prefer this before reading files when the exact path is unknown.',
        riskLevel: 'read',
        profiles: ['interactive', 'full'],
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Filename or path fragment to search for.',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of files to return. Defaults to 20, capped at 100.',
            },
            includePatterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional glob patterns to include.',
            },
            excludePatterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional glob patterns to exclude.',
            },
          },
          required: ['query'],
        },
        execute: async (params: Record<string, unknown>) => {
          const query = typeof params.query === 'string' ? params.query.trim() : '';
          if (!query) {
            return errorResult('INVALID_INPUT', new Error('query is required'));
          }
          const workspaceService = tryGetService<IWorkspaceService>(container, IWorkspaceService);
          if (!workspaceService) {
            return serviceUnavailableResult('IWorkspaceService');
          }
          const fileSearchService = tryGetService<IFileSearchService>(container, FileSearchServicePath);
          if (!fileSearchService) {
            return serviceUnavailableResult('FileSearchServicePath');
          }
          try {
            const rootUris = getWorkspaceRootPaths(workspaceService);
            const maxResults = toPositiveCappedNumber(params.maxResults, DEFAULT_FILE_RESULTS, MAX_FILE_RESULTS);
            const searchPattern = getValidateInput(query.replace(/\s/g, ''));
            const results = await fileSearchService.find(searchPattern, {
              rootUris,
              excludePatterns: [
                ...Object.keys(defaultFilesWatcherExcludes),
                ...(asStringArray(params.excludePatterns) ?? []),
              ],
              includePatterns: asStringArray(params.includePatterns),
              limit: maxResults,
              useGitIgnore: true,
              noIgnoreParent: true,
              fuzzyMatch: true,
            });
            return successResult({
              query,
              files: results.slice(0, maxResults).map((path) => ({ path })),
              total: results.length,
              truncated: results.length > maxResults,
            });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
      {
        name: 'search_text',
        description:
          'Search text across workspace files. Returns matching file path, line, column, and a shortened line preview.',
        riskLevel: 'read',
        profiles: ['interactive', 'full'],
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Text or regular expression to search for.',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of matches to return. Defaults to 50, capped at 200.',
            },
            include: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional glob patterns to include.',
            },
            exclude: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional glob patterns to exclude.',
            },
            matchCase: {
              type: 'boolean',
              description: 'Whether matching is case-sensitive.',
            },
            matchWholeWord: {
              type: 'boolean',
              description: 'Whether to match whole words only.',
            },
            useRegExp: {
              type: 'boolean',
              description: 'Whether query is a regular expression.',
            },
            includeIgnored: {
              type: 'boolean',
              description: 'Whether to include gitignored and hidden files.',
            },
          },
          required: ['query'],
        },
        execute: async (params: Record<string, unknown>) => {
          const query = typeof params.query === 'string' ? params.query : '';
          if (!query) {
            return errorResult('INVALID_INPUT', new Error('query is required'));
          }
          const searchService = tryGetService<ContentSearchClientService>(container, IContentSearchClientService);
          if (!searchService) {
            return serviceUnavailableResult('IContentSearchClientService');
          }
          try {
            const maxResults = toPositiveCappedNumber(params.maxResults, DEFAULT_TEXT_RESULTS, MAX_TEXT_RESULTS);
            const cancellation = new CancellationTokenSource();
            searchService.cleanSearchResults();
            await searchService.doSearch(
              query,
              {
                ...searchService.UIState,
                isMatchCase: Boolean(params.matchCase),
                isWholeWord: Boolean(params.matchWholeWord),
                isUseRegexp: Boolean(params.useRegExp),
                isIncludeIgnored: Boolean(params.includeIgnored),
                include: asStringArray(params.include),
                exclude: asStringArray(params.exclude),
                maxResults,
              },
              cancellation.token,
            );
            const { timedOut } = await waitForSearchDone(searchService, SEARCH_TIMEOUT_MS);
            if (timedOut) {
              cancellation.cancel();
            }
            const matches = flattenSearchResults(searchService.searchResults, maxResults);
            return successResult({
              query,
              matches,
              total: searchService.resultTotal.resultNum,
              fileTotal: searchService.resultTotal.fileNum,
              truncated: searchService.resultTotal.resultNum > matches.length,
              timedOut,
              searchState: SEARCH_STATE[searchService.searchState],
              error: searchService.searchError || undefined,
            });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
      {
        name: 'search_symbols',
        description: 'Search workspace symbols through registered language providers.',
        riskLevel: 'read',
        profiles: ['interactive', 'full'],
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Symbol name or partial name to search for.',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of symbols to return. Defaults to 50, capped at 200.',
            },
          },
          required: ['query'],
        },
        execute: async (params: Record<string, unknown>) => {
          const query = typeof params.query === 'string' ? params.query.trim() : '';
          if (!query) {
            return errorResult('INVALID_INPUT', new Error('query is required'));
          }
          const languageService = tryGetService<ILanguageService>(container, ILanguageService);
          if (!languageService) {
            return serviceUnavailableResult('ILanguageService');
          }
          try {
            const maxResults = toPositiveCappedNumber(params.maxResults, DEFAULT_TEXT_RESULTS, MAX_TEXT_RESULTS);
            const providerResults = await Promise.all(
              languageService.workspaceSymbolProviders.map((provider) =>
                Promise.resolve(provider.provideWorkspaceSymbols({ query }, CancellationToken.None)).catch(() => []),
              ),
            );
            const symbols = providerResults
              .flat()
              .slice(0, maxResults)
              .map((symbol) => ({
                name: symbol.name,
                kind: symbol.kind,
                containerName: symbol.containerName,
                uri: symbol.location.uri,
                path: URI.parse(symbol.location.uri).codeUri.fsPath,
                range: symbol.location.range,
              }));
            return successResult({
              query,
              symbols,
              total: providerResults.reduce((count, result) => count + result.length, 0),
              truncated: providerResults.reduce((count, result) => count + result.length, 0) > symbols.length,
            });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
    ],
  };
}
