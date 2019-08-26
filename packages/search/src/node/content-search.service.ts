import { Injectable, Autowired } from '@ali/common-di';
import { IProcessFactory, IProcess, ProcessOptions } from '@ali/ide-process';
import { rgPath } from '@ali/vscode-ripgrep';
import { FileUri } from '@ali/ide-core-node';
import { RPCService } from '@ali/ide-connection';
import { ILogServiceManage, SupportLogNamespace, ILogService } from '@ali/ide-logs/lib/node';
import {
  IContentSearchServer,
  ContentSearchOptions,
  ContentSearchResult,
  SEARCH_STATE,
  SendClientResult,
  anchorGlob,
  getRoot,
} from '../common';

interface RipGrepArbitraryData {
  text?: string;
  bytes?: string;
}

interface SearchInfo {
  searchId: number;
  resultLength: number;
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
    if (codePoint < 0x7F) {
      byteIdx++;
    } else if (codePoint < 0x7FF) {
      byteIdx += 2;
    } else if (codePoint < 0xFFFF) {
      byteIdx += 3;
    } else if (codePoint < 0x10FFFF) {
      byteIdx += 4;
    } else {
      throw new Error('Invalid UTF-8 string');
    }
  }

  return char - charStart;
}

@Injectable()
export class ContentSearchService extends RPCService implements IContentSearchServer {

  @Autowired(IProcessFactory)
  protected processFactory: IProcessFactory;

  private searchId: number = 0;
  private processMap: Map<number, IProcess> = new Map();

  @Autowired(ILogServiceManage)
  loggerMange: ILogServiceManage;
  logger: ILogService = this.loggerMange.getLogger(SupportLogNamespace.Node);

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

  async search(what: string, rootUris: string[], opts?: ContentSearchOptions, cb?: (data: any) => {}): Promise<number> {
    // Start the rg process.  Use --vimgrep to get one result per
    // line, --color=always to get color control characters that
    // we'll use to parse the lines.
    const args = this.getSearchArgs(opts);
    // if we use matchWholeWord we use regExp internally,
    // so, we need to escape regexp characters if we actually not set regexp true in UI.
    if (opts && opts.matchWholeWord && !opts.useRegExp) {
      what = what.replace(/[\-\\\{\}\*\+\?\|\^\$\.\[\]\(\)\#]/g, '\\$&');
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
    };

    const processOptions: ProcessOptions = {
      command: rgPath,
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
      this.parseDataBuffer(chunk, searchInfo, opts, rootUris);
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

  private parseDataBuffer(
    dataString: string,
    searchInfo: SearchInfo,
    opts?: ContentSearchOptions,
    rootUris?: string[],
  ) {
    const lines = dataString.toString().split('\n');
    const result: ContentSearchResult[] = [];

    if (lines.length < 1) {
      return;
    }

    lines.some((line) => {
      let lintObj;
      try {
        lintObj = JSON.parse(line.trim());
      } catch (e) { }
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

          const searchResult: ContentSearchResult = {
            fileUri: fileUri.toString(),
            root: getRoot(rootUris, fileUri.codeUri.path),
            line,
            matchStart: character + 1,
            matchLength,
            lineText: lineText.replace(/[\r\n]+$/, ''),
          };

          if (opts && opts.maxResults && searchInfo.resultLength >= opts.maxResults) {
            // 达到设置上限，停止搜索
            this.cancel(searchInfo.searchId);
            return true;
          }
          result.push(searchResult);
          searchInfo.resultLength++;
        }
      }
    });
    this.sendResultToClient(result, searchInfo.searchId);
  }

  private sendResultToClient(
    data: ContentSearchResult[],
    id: number,
    searchState?: SEARCH_STATE,
    error?: string,
  ) {
    if (this.rpcClient) {
      this.rpcClient.forEach((client) => {
        client.onSearchResult({
          data, id, searchState, error,
        } as SendClientResult);
      });
    }
  }

  private getSearchArgs(options?: ContentSearchOptions): string[] {
    const args = ['--json', '--max-count=100', '--no-ignore-parent'];
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
    if (options && options.useRegExp || options && options.matchWholeWord) {
      args.push('--regexp');
    } else {
      args.push('--fixed-strings');
      args.push('--');
    }
    return args;
  }
}
