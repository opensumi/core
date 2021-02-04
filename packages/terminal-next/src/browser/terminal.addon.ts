import { Terminal, ILinkMatcherOptions, ITerminalAddon } from 'xterm';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';
import { URI, Disposable, Deferred } from '@ali/ide-core-common';
import { WorkbenchEditorService } from '@ali/ide-editor/lib/common';
import { TerminalKeyBoardInputService } from './terminal.input';
import { ITerminalConnection } from '../common';

const segmentClause = '\\w\\.@_\\-';
const posClause = [
  ':\\d+(?::\\d+)?', // :1 | :1:2
  '\\s*\\(\\d+(?:,\\s*\\d+)?\\)', // (1) | (1,2) | (1, 2)
].join('|');
const pathClause = [
  // Unix
  `[${segmentClause}]*(?:/[${segmentClause}]+)+`,
  // Windows 应该只在 electron 场景用到
  // Windows https://docs.microsoft.com/en-us/dotnet/standard/io/file-path-formats
  // C:\xxx\xxx
  // \\.\c:\xxx\xxx
  // \\?\c:\xxx\xxx
  `(?:(?:\\\\\\\\[.?]\\\\)?[a-zA-Z]:\\\\)?[${segmentClause}]+(?:\\\\[${segmentClause}]+)+`,
].join('|');
export const rePath = new RegExp(`(${pathClause})(${posClause})?`);

export class FilePathAddon extends Disposable implements ITerminalAddon {
  private _linkMatcherId: number | undefined;
  private _terminal: Terminal | undefined;

  constructor(
    private _workspace: string,
    private _fileService: IFileServiceClient,
    private _editorService: WorkbenchEditorService,
    private _keyboardService: TerminalKeyBoardInputService,
    private _options: ILinkMatcherOptions = {},
  ) {
    super();
    this._options.matchIndex = 0;
    this._options.validationCallback = this._checkPathValid.bind(this);
  }

  private _parseUri(uri: string) {
    const [, path, pos] = uri.match(rePath)!;
    const posArr: number[] = [];
    const reNum = /\d+/g;
    if (pos) {
      let res: string[] | null;
      while ((res = reNum.exec(pos))) {
        posArr.push(+res[0]);
      }
    }
    const [row, col] = posArr;
    return { path: this._absolutePath(path), row, col };
  }

  private _absolutePath(uri: string) {
    let absolute: string | undefined;
    if (uri[0] !== '/') {
      if (this._workspace) {
        // 一致处理为无 file scheme 的绝对地址
        absolute = this._workspace;
      } else {
        throw new Error('not found workspace dir');
      }
    } else {
      absolute = uri;
    }
    return absolute;
  }

  private _checkPathValid(uri: string, callback: (valid: boolean) => void) {
    try {
      const absolute = this._parseUri(uri).path;
      this._fileService.getFileStat(URI.file(absolute).toString())
        .then((stat) => {
          if (stat) {
            callback(true);
          } else {
            callback(false);
          }
        });
    } catch {
      callback(false);
    }
  }

  private async _openFile(_, uri: string) {
    if (!this._keyboardService.isCommandOrCtrl) {
      return;
    }

    const uriInfo = this._parseUri(uri);
    const fileUri = URI.file(uriInfo.path);
    if (fileUri && fileUri.scheme === 'file') {
      const stat = await this._fileService.getFileStat(fileUri.toString());
      if (stat && !stat.isDirectory) {
        this._editorService.open(new URI(stat.uri), uriInfo.row && uriInfo.col ? {
          range: {
            startLineNumber: uriInfo.row,
            endLineNumber: uriInfo.row,
            startColumn: uriInfo.col,
            endColumn: uriInfo.col,
          },
        } : {});
      }
    }
  }

  activate(terminal: Terminal): void {
    this._terminal = terminal;
    this._linkMatcherId = this._terminal.registerLinkMatcher(rePath, this._openFile.bind(this), this._options);

    this.addDispose({
      dispose: () => {
        if (this._linkMatcherId !== undefined && this._terminal !== undefined) {
          this._terminal.deregisterLinkMatcher(this._linkMatcherId);
        }
      },
    });
  }
}

export class AttachAddon extends Disposable implements ITerminalAddon {
  private _connection: ITerminalConnection;
  private _connected: Deferred<void> = new Deferred();

  public setConnection(connection: ITerminalConnection) {
    this._connection = connection;
    this._connected.resolve();
  }

  public async activate(terminal: Terminal): Promise<void> {
    await this._connected.promise;
    this.addDispose(
      this._connection.onData((data: string | ArrayBuffer) => {
        terminal.write(typeof data === 'string' ? data : new Uint8Array(data));
      }),
    );

    if (!this._connection.readonly) {
      this.addDispose(terminal.onData((data) => this._sendData(data)));
      this.addDispose(terminal.onBinary((data) => this._sendBinary(data)));
    }
  }

  private _sendData(data: string): void {
    this._connection.sendData(data);
  }

  private _sendBinary(data: string): void {
    const buffer = new Uint8Array(data.length);
    for (let i = 0; i < data.length; ++i) {
      buffer[i] = data.charCodeAt(i) & 255;
    }
    this._connection.sendData(buffer);
  }
}

export const DEFAULT_ROW = 80;
export const DEFAULT_COL = 24;
