import readline from 'readline';

import fuzzy from 'fuzzy';

import { Autowired, Injectable } from '@opensumi/di';
import { CancellationToken, CancellationTokenSource, path } from '@opensumi/ide-core-common';
import { INodeLogger } from '@opensumi/ide-core-node';
import { IProcessFactory } from '@opensumi/ide-process';
import { rgPath } from '@opensumi/vscode-ripgrep';

import { IFileSearchService } from '../common';

const { replaceAsarInPath, Path, dirname } = path;

@Injectable()
export class FileSearchService implements IFileSearchService {
  @Autowired(IProcessFactory)
  processFactory: IProcessFactory;

  @Autowired(INodeLogger)
  logger: INodeLogger;

  private isAbsolutePathPattern(pattern: string): boolean {
    return path.isAbsolute(pattern) || pattern.startsWith('/') || pattern.startsWith('\\');
  }

  // 这里应该返回文件的 `fsPath` 而非 `file://` 协议文件路径
  // 否则在 Windows 下，盘符路径会被隐藏
  async find(
    searchPattern: string,
    options: IFileSearchService.Options,
    clientToken?: CancellationToken,
  ): Promise<string[]> {
    const cancellationSource = new CancellationTokenSource();
    if (clientToken) {
      clientToken.onCancellationRequested(() => cancellationSource.cancel());
    }
    const token = cancellationSource.token;
    const opts = {
      fuzzyMatch: true,
      limit: Number.MAX_SAFE_INTEGER,
      useGitIgnore: true,
      ...options,
    };

    const roots: IFileSearchService.RootOptions = options.rootOptions || {};
    let stringPattern = searchPattern.toLocaleLowerCase();

    // 如果传入绝对路径，则将父级目录作为根目录
    if (this.isAbsolutePathPattern(searchPattern)) {
      const parent = path.dirname(searchPattern);
      roots[parent] = {};
      stringPattern = path.basename(searchPattern).toLocaleLowerCase();
    }

    if (options.rootUris) {
      for (const rootUri of options.rootUris) {
        if (!roots[rootUri]) {
          roots[rootUri] = {};
        }
      }
    }

    // eslint-disable-next-line guard-for-in
    for (const rootUri in roots) {
      const rootOptions = roots[rootUri];
      if (opts.includePatterns) {
        const includePatterns = rootOptions.includePatterns || [];
        rootOptions.includePatterns = [...includePatterns, ...opts.includePatterns];
      }
      if (opts.excludePatterns) {
        const excludePatterns = rootOptions.excludePatterns || [];
        rootOptions.excludePatterns = [...excludePatterns, ...opts.excludePatterns];
      }
      if (rootOptions.useGitIgnore === undefined) {
        rootOptions.useGitIgnore = opts.useGitIgnore;
      }
      if (rootOptions.noIgnoreParent === undefined) {
        rootOptions.noIgnoreParent = opts.noIgnoreParent;
      }
    }

    const exactMatches = new Set<string>();
    const fuzzyMatches = new Set<string>();

    await Promise.all(
      Object.keys(roots).map(async (cwd) => {
        try {
          const rootOptions = roots[cwd];
          await this.doFind(
            cwd,
            rootOptions,
            (candidate) => {
              const fileUri = path.join(cwd, candidate);
              if (exactMatches.has(fileUri) || fuzzyMatches.has(fileUri)) {
                return;
              }
              if (
                !searchPattern ||
                searchPattern === '*' ||
                candidate.toLocaleLowerCase().indexOf(stringPattern) !== -1
              ) {
                exactMatches.add(fileUri);
              } else if (opts.fuzzyMatch && fuzzy.test(searchPattern, candidate)) {
                fuzzyMatches.add(fileUri);
              }
              if (exactMatches.size + fuzzyMatches.size === opts.limit) {
                cancellationSource.cancel();
              }
            },
            token,
          );
        } catch (e) {
          this.logger.error(`Failed to search on path ${cwd}.\n${e}`);
        }
      }),
    );
    const sortedExactMatches = Array.from(exactMatches).sort((a, b) => {
      const depthA = Path.pathDepth(a);
      const depthB = Path.pathDepth(a);
      if (depthA === depthB) {
        const dirA = dirname(a);
        const dirB = dirname(b);
        return dirB.localeCompare(dirA, 'en', { numeric: true });
      } else {
        return depthB - depthA;
      }
    });

    return [...sortedExactMatches, ...fuzzyMatches];
  }

  private doFind(
    cwd: string,
    options: IFileSearchService.BaseOptions,
    accept: (fileUri: string) => void,
    token: CancellationToken,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const args = this.getSearchArgs(options);
        const process = this.processFactory.create({ command: replaceAsarInPath(rgPath), args, options: { cwd } });
        process.onError(reject);
        process.outputStream.on('close', resolve);

        const lineReader = readline.createInterface({
          input: process.outputStream,
          output: process.inputStream,
        });
        lineReader.on('line', (line) => {
          if (token.isCancellationRequested) {
            process.dispose();
          } else {
            accept(line);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  private getSearchArgs(options: IFileSearchService.BaseOptions): string[] {
    const args = ['--files', '--hidden', '--case-sensitive', '--no-require-git'];
    if (options.includePatterns) {
      for (const includePattern of options.includePatterns) {
        if (includePattern) {
          args.push('--glob', includePattern);
        }
      }
    }
    if (options.excludePatterns) {
      for (const excludePattern of options.excludePatterns) {
        if (excludePattern) {
          args.push('--glob', `!${excludePattern}`);
        }
      }
    }
    if (!options.useGitIgnore) {
      args.push('-uu');
    }
    if (options.noIgnoreParent) {
      args.push('--no-ignore-parent');
    }
    return args;
  }
}
