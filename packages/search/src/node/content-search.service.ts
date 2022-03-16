import { Injectable, Autowired } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection';
import { FileUri, replaceAsarInPath } from '@opensumi/ide-core-node';
import { ILogServiceManager, SupportLogNamespace, ILogService } from '@opensumi/ide-logs/lib/node';
import { IProcessFactory, IProcess, ProcessOptions } from '@opensumi/ide-process';
import { rgPath } from '@opensumi/vscode-ripgrep';

import {
  IContentSearchServer,
  ContentSearchOptions,
  ContentSearchResult,
  SEARCH_STATE,
  SendClientResult,
  anchorGlob,
  cutShortSearchResult,
  FilterFileWithGlobRelativePath,
} from '../common';
interface RipGrepArbitraryData {
  text?: string;
  bytes?: string;
}

interface SearchInfo {
  searchId: number;
  resultLength: number;
  dataBuf: string;
}

/**
 * Convert the length of a range in `text` expressed in bytes to a number of
 * characters (or more precisely, code points).  The range starts at character
 * `charStart` in `text`.
 */
function byteRangeLengthToCharacterLength(text: string, charStart: number, byteLength: number): number {
  let char: number = charStart;
  for (let byteIdx = 0; byteIdx < byteLength; char++) {
    const codePoint: number = text.charCodeAt(char);
    if (codePoint < 0x7f) {
      byteIdx++;
    } else if (codePoint < 0x7ff) {
      byteIdx += 2;
    } else if (codePoint < 0xffff) {
      byteIdx += 3;
    } else if (codePoint < 0x10ffff) {
      byteIdx += 4;
    } else {
      throw new Error('Invalid UTF-8 string');
    }
  }

  return char - charStart;
}

interface IRPCContentSearchService {
  onSearchResult(sendClientResult: SendClientResult): void;
}

@Injectable()
export class ContentSearchService extends RPCService<IRPCContentSearchService> implements IContentSearchServer {
  @Autowired(IProcessFactory)
  protected processFactory: IProcessFactory;

  private searchId: number = new Date().getTime();
  private processMap: Map<number, IProcess> = new Map();

  @Autowired(ILogServiceManager)
  loggerManager!: ILogServiceManager;
  logger: ILogService = this.loggerManager.getLogger(SupportLogNamespace.Node);

  constructor() {
    super();
  }

  private searchStart(searchId, searchProcess) {
    this.sendResultToClient([], searchId, SEARCH_STATE.doing);
    this.processMap.set(searchId, searchProcess);
  }

  private searchEnd(searchId) {
    this.sendResultToClient([], searchId, SEARCH_STATE.done);
    this.processMap.delete(searchId);
  }

  private searchError(searchId, error: string) {
    this.sendResultToClient([], searchId, SEARCH_STATE.error, error);
    this.processMap.delete(searchId);
  }

  async search(
    what: string,
    rootUris: string[],
    opts?: ContentSearchOptions,
    cb?: (data: any) => any,
  ): Promise<number> {
    const args = this.getSearchArgs(opts);

    if (opts && opts.matchWholeWord && !opts.useRegExp) {
      what = what.replace(/[-\\{}*+?|^$.[\]()#]/g, '\\$&');
      if (!/\B/.test(what.charAt(0))) {
        what = '\\b' + what;
      }
      if (!/\B/.test(what.charAt(what.length - 1))) {
        what = what + '\\b';
      }
    }

    const searchInfo: SearchInfo = {
      searchId: this.searchId++,
      resultLength: 0,
      dataBuf: '',
    };

    const processOptions: ProcessOptions = {
      command: replaceAsarInPath(rgPath),
      args: [...args, what].concat(rootUris.map((root) => FileUri.fsPath(root))),
    };

    const rgProcess: IProcess = this.processFactory.create(processOptions);
    this.searchStart(searchInfo.searchId, rgProcess);
    rgProcess.onError((error) => {
      // tslint:disable-next-line:no-any
      let errorCode = (error as any).code;

      // Try to provide somewhat clearer error messages, if possible.
      if (errorCode === 'ENOENT') {
        errorCode = 'could not find the ripgrep (rg) binary';
      } else if (errorCode === 'EACCES') {
        errorCode = 'could not execute the ripgrep (rg) binary';
      }

      const errorStr = `An error happened while searching (${errorCode}).`;

      this.logger.error(errorStr);
      this.searchError(searchInfo.searchId, errorStr);
    });

    rgProcess.outputStream.on('data', (chunk: string) => {
      searchInfo.dataBuf = searchInfo.dataBuf + chunk;
      this.parseDataBuffer(searchInfo, opts, rootUris);
    });

    rgProcess.onExit(() => {
      this.searchEnd(searchInfo.searchId);
    });

    return searchInfo.searchId;
  }

  cancel(searchId: number): Promise<void> {
    const process = this.processMap.get(searchId);
    if (process) {
      process.dispose();
      this.processMap.delete(searchId);
    }
    return Promise.resolve();
  }

  private parseDataBuffer(searchInfo: SearchInfo, opts?: ContentSearchOptions, rootUris?: string[]) {
    const lines = searchInfo.dataBuf.toString().split('\n');
    const result: ContentSearchResult[] = [];
    let filterFileWithGlobRelativePath: FilterFileWithGlobRelativePath;

    if (lines.length < 1) {
      return;
    }

    if (rootUris && opts) {
      filterFileWithGlobRelativePath = new FilterFileWithGlobRelativePath(rootUris, opts.include || []);
    }

    lines.some((line) => {
      // 读一行清理一行
      const eolIdx = searchInfo.dataBuf.indexOf('\n');
      if (eolIdx > -1) {
        searchInfo.dataBuf = searchInfo.dataBuf.slice(eolIdx + 1);
      }

      let lintObj;
      try {
        lintObj = JSON.parse(line.trim());
      } catch (e) {}
      if (!lintObj) {
        return;
      }

      if (lintObj.type === 'match') {
        const data = lintObj.data;
        const file = (data.path as RipGrepArbitraryData).text;
        const line = data.line_number;
        const lineText = (data.lines as RipGrepArbitraryData).text;

        if (file === undefined || lineText === undefined) {
          return;
        }

        for (const submatch of data.submatches) {
          const startByte = submatch.start;
          const endByte = submatch.end;
          const character = byteRangeLengthToCharacterLength(lineText, 0, startByte);
          const matchLength = byteRangeLengthToCharacterLength(lineText, character, endByte - startByte);
          const fileUri = FileUri.create(file);
          const fileUriSting = fileUri.toString();

          if (filterFileWithGlobRelativePath && !filterFileWithGlobRelativePath.test(fileUriSting)) {
            continue;
          }
          const searchResult: ContentSearchResult = cutShortSearchResult({
            fileUri: fileUriSting,
            line,
            matchStart: character + 1,
            matchLength,
            lineText: lineText.replace(/[\r\n]+$/, ''),
          });

          if (opts && opts.maxResults && searchInfo.resultLength >= opts.maxResults) {
            // 达到设置上限，停止搜索
            this.logger.debug('达到设置上限，停止搜索');
            this.cancel(searchInfo.searchId);
            return true;
          }
          result.push(searchResult);
          searchInfo.resultLength++;
        }
      }
    });

    if (!result || result.length === 0) {
      return;
    }
    this.sendResultToClient(result, searchInfo.searchId);
  }

  private sendResultToClient(data: ContentSearchResult[], id: number, searchState?: SEARCH_STATE, error?: string) {
    if (this.client) {
      this.client.onSearchResult({
        data,
        id,
        searchState,
        error,
      } as SendClientResult);
    }
  }

  private getSearchArgs(options?: ContentSearchOptions): string[] {
    const args = ['--json', '--max-count=100'];
    args.push(options && options.matchCase ? '--case-sensitive' : '--ignore-case');
    if (options && options.includeIgnored) {
      args.push('-uu');
    }
    if (options && options.include) {
      for (const include of options.include) {
        if (include !== '') {
          args.push('--glob=' + anchorGlob(include));
        }
      }
    }
    if (options && options.exclude) {
      for (const exclude of options.exclude) {
        if (exclude !== '') {
          args.push('--glob=!' + anchorGlob(exclude));
        }
      }
    }

    if (options && options.encoding && options.encoding !== 'utf8') {
      args.push('--encoding', options.encoding);
    }

    if ((options && options.useRegExp) || (options && options.matchWholeWord)) {
      args.push('--regexp');
    } else {
      args.push('--fixed-strings');
      args.push('--');
    }
    return args;
  }
}
