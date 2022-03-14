import { Terminal, ILinkMatcherOptions, ITerminalAddon } from 'xterm';

import { URI, Disposable, Emitter, Event } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor/lib/common';
import { IFileServiceClient, FileStat } from '@opensumi/ide-file-service/lib/common';

import { ITerminalConnection } from '../common';

import { TerminalKeyBoardInputService } from './terminal.input';


const segmentClause = '\\~\\w\\.@_\\-';
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
export const rePath = new RegExp(`(?:^|\s)((?:${pathClause})(?:${posClause})?)`);

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
    this._options.matchIndex = 1;
  }

  private _mayAbsolutePath(uri: string) {
    // 同时校验相对路径和绝对路径
    // 单纯从链接层面无法区分
    // 只能够全部交给 file api 去判断
    // 两个同时匹配的时候，优先取相对路径
    return [
      // 这里无须使用 join，前置的 match 来保证
      this._workspace + (uri[0] === '/' ? '' : '/') + uri,
      uri,
    ];
  }

  private async filterAvailablePaths(paths: string[]) {
    try {
      const promises: Promise<FileStat | undefined>[] = [];
      paths.map((absolute) => promises.push(this._fileService.getFileStat(URI.file(absolute).toString())));
      const stats = await Promise.all(promises);
      return stats
        .filter((s) => !!s && !s.isDirectory && new URI(s!.uri).scheme === 'file')
        .map((s) => new URI(s!.uri).codeUri.fsPath);
    } catch {
      return [];
    }
  }

  private async _parseUri(uri: string) {
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
    return {
      paths: await this.filterAvailablePaths(this._mayAbsolutePath(path)),
      row,
      col,
    };
  }

  private async _openFile(_, uri: string) {
    if (!this._keyboardService.isCommandOrCtrl) {
      return;
    }

    const uriInfo = await this._parseUri(uri);

    for (const path of uriInfo.paths) {
      const fileUri = URI.file(path);
      this._editorService.open(
        fileUri,
        uriInfo.row && uriInfo.col
          ? {
              range: {
                startLineNumber: uriInfo.row,
                endLineNumber: uriInfo.row,
                startColumn: uriInfo.col,
                endColumn: uriInfo.col,
              },
            }
          : {},
      );
      break;
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
  connection: ITerminalConnection | undefined;
  private _disposeConnection: Disposable | null;
  private _terminal: Terminal;

  private _onData = new Emitter<string | ArrayBuffer>();
  onData = this._onData.event;

  private _onExit = new Emitter<number | undefined>();
  onExit = this._onExit.event;

  private _onTime = new Emitter<number>();
  onTime = this._onTime.event;

  private _lastInputTime = 0;

  public setConnection(connection: ITerminalConnection | undefined) {
    if (this._disposeConnection) {
      this._disposeConnection.dispose();
      this._disposeConnection = null;
    }
    this.connection = connection;
    if (connection) {
      this._disposeConnection = new Disposable(
        connection.onData((data: string | ArrayBuffer) => {
          this._terminal.write(typeof data === 'string' ? data : new Uint8Array(data));
          this._onData.fire(data);
          if (this._lastInputTime) {
            const delta = Date.now() - this._lastInputTime;
            this._lastInputTime = 0;
            this._onTime.fire(delta);
          }
        }),
      );
      if (connection.onExit) {
        this._disposeConnection.addDispose(
          connection.onExit((code) => {
            this._onExit.fire(code);
          }),
        );
      }
    }
  }

  public async activate(terminal: Terminal): Promise<void> {
    this._terminal = terminal;
    this.addDispose(Disposable.create(() => this._disposeConnection?.dispose()));
    this.addDispose(terminal.onData((data) => this._sendData(data)));
    this.addDispose(terminal.onBinary((data) => this._sendBinary(data)));
  }

  private _sendData(data: string): void {
    if (!this.connection || this.connection.readonly) {
      return;
    }
    this._timeResponse();
    this.connection.sendData(data);
  }

  private _sendBinary(data: string): void {
    if (!this.connection || this.connection.readonly) {
      return;
    }
    const buffer = new Uint8Array(data.length);
    for (let i = 0; i < data.length; ++i) {
      buffer[i] = data.charCodeAt(i) & 255;
    }
    this._timeResponse();
    this.connection.sendData(buffer);
  }

  private _timeResponse() {
    this._lastInputTime = Date.now();
  }
}

export const DEFAULT_ROW = 80;
export const DEFAULT_COL = 24;
