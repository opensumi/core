import { Injectable, Autowired } from '@ali/common-di';
import { IProcessFactory, IProcess, ProcessOptions } from '@ali/ide-process';
import { getLogger } from '@ali/ide-core-common';
import { rgPath } from '@ali/vscode-ripgrep';
import { FileUri } from '@ali/ide-core-node';
import { RPCService } from '@ali/ide-connection';
import {
  IContentSearchServer,
  ContentSearchOptions,
  ContentSearchResult,
  SEARCH_STATE,
  SendClientResult,
} from '../common';

const logger = getLogger();

interface RipGrepArbitraryData {
  text?: string;
  bytes?: string;
}

interface SearchInfo {
  searchID: number;
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

  private searchID: number = 0;
  private processMap: Map<number, IProcess> = new Map();

  constructor() {
    super();
  }

  private searchStart(searchID, searchProcess) {
    this.sendResultToClient([], searchID, SEARCH_STATE.doing);
    this.processMap.set(searchID, searchProcess);
  }

  private searchEnd(searchID) {
    this.sendResultToClient([], searchID, SEARCH_STATE.done);
    this.processMap.delete(searchID);
  }

  private searchError(searchID, error: string) {
    this.sendResultToClient([], searchID, SEARCH_STATE.error, error);
    this.processMap.delete(searchID);
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
      searchID: this.searchID++,
      resultLength: 0,
    };

    const processOptions: ProcessOptions = {
      command: rgPath,
      args: [...args, what].concat(rootUris.map((root) => FileUri.fsPath(root))),
    };

    const rgProcess: IProcess = this.processFactory.create(processOptions);
    this.searchStart(searchInfo.searchID, rgProcess);
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

      logger.error(errorStr);
      this.searchError(searchInfo.searchID, errorStr);
    });

    rgProcess.outputStream.on('data', (chunk: string) => {
      this.parseDataBuffer(chunk, searchInfo, opts);
    });

    rgProcess.onExit(() => {
      this.searchEnd(searchInfo.searchID);
    });

    return searchInfo.searchID;
  }

  cancel(searchId: number): Promise<void> {
    const process = this.processMap.get(searchId);
    if (process) {
      process.dispose();
    }
    return Promise.resolve();
  }

  private parseDataBuffer(
    dataString: string,
    searchInfo: SearchInfo,
    opts?: ContentSearchOptions,
  ) {
    const lines = dataString.toString().split('\n');
    const result: ContentSearchResult[] = [];

    if (lines.length < 1) {
      return;
    }

    lines.forEach((line) => {
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

          const searchResult: ContentSearchResult = {
            fileUri: FileUri.create(file).toString(),
            root: '',
            line,
            matchStart: character + 1,
            matchLength,
            lineText: lineText.replace(/[\r\n]+$/, ''),
          };

          result.push(searchResult);
          searchInfo.resultLength++;

          if (opts && opts.maxResults && searchInfo.resultLength >= opts.maxResults) {

          }
        }
      }

    });

    this.sendResultToClient(result, searchInfo.searchID);
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
          args.push('--glob=**/' + include);
        }
      }
    }
    if (options && options.exclude) {
      for (const exclude of options.exclude) {
        if (exclude !== '') {
          args.push('--glob=!**/' + exclude);
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
