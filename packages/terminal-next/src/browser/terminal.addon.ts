import { Terminal, ILinkMatcherOptions, ITerminalAddon } from 'xterm';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';
import { URI, Disposable, Deferred } from '@ali/ide-core-common';
import { IWorkspaceService } from '@ali/ide-workspace/lib/common';
import { WorkbenchEditorService } from '@ali/ide-editor/lib/common';
import { TerminalKeyBoardInputService } from './terminal.input';
import { ITerminalConnection } from '../common';

const linuxFilePathRegex = /((\/$|(\/?[\w\.\@\-\_]+)?(\/[\w\.\@\~\-\_]+)+(:[0-9]*:[0-9]*)?)+)/;
const windowsFilePathRegex = new RegExp('(?:[a-zA-Z]\:|\\\\[\w\.]+\\[\w.$]+)\\(?:[\w]+\\)*\w([\w.])+(:[0-9]*:[0-9]*)?');

export class FilePathAddon extends Disposable implements ITerminalAddon {
  private _linuxLinkMatcherId: number | undefined;
  private _windowsLinkMatchId: number | undefined;
  private _terminal: Terminal | undefined;

  constructor(
    private _workspace: IWorkspaceService,
    private _fileService: IFileServiceClient,
    private _editorService: WorkbenchEditorService,
    private _keyboardService: TerminalKeyBoardInputService,
    private _options: ILinkMatcherOptions = {},
  ) {
    super();
    this._options.matchIndex = 2;
    this._options.validationCallback = this._checkPathValid.bind(this);
  }

  private _absolutePath(uri: string) {
    let absolute: string | undefined;
    if (uri[0] !== '/') {
      if (this._workspace.workspace) {
        // 一致处理为无 file scheme 的绝对地址
        absolute = `${this._workspace.workspace.uri}/${uri}`.substring(7);
      } else {
        throw new Error('not found workspace dir');
      }
    } else {
      absolute = uri;
    }
    return absolute;
  }

  private _checkPathValid(uri: string, callback: (valid: boolean) => void) {
    const uriArray = uri.split(':');
    const absolute = this._absolutePath(uriArray[0]);

    this._fileService.getFileStat(URI.file(absolute).toString())
      .then((stat) => {
        if (stat) {
          callback(true);
        } else {
          callback(false);
        }
      });
  }

  private async _openFile(_, uri: string) {
    if (!this._keyboardService.isCommandOrCtrl) {
      return;
    }

    const uriArray = uri.split(':');
    const absolute = this._absolutePath(uriArray[0]);

    if (absolute) {
      const fileUri = URI.file(absolute);
      if (fileUri && fileUri.scheme === 'file') {
        const stat = await this._fileService.getFileStat(fileUri.toString());
        if (stat && !stat.isDirectory) {
          this._editorService.open(new URI(stat.uri), (uriArray[1] && uriArray[2]) ? {
            range: {
              startLineNumber: parseInt(uriArray[1], 10),
              endLineNumber: parseInt(uriArray[1], 10),
              startColumn: parseInt(uriArray[2], 10) + 1,
              endColumn: parseInt(uriArray[2], 10) + 1,
            },
          } : {});
        }
      }
    }
  }

  activate(terminal: Terminal): void {
    this._terminal = terminal;
    this._linuxLinkMatcherId = this._terminal.registerLinkMatcher(linuxFilePathRegex, this._openFile.bind(this), this._options);
    this._windowsLinkMatchId = this._terminal.registerLinkMatcher(windowsFilePathRegex, this._openFile.bind(this), this._options);

    this.addDispose({
      dispose: () => {
        if (this._linuxLinkMatcherId !== undefined && this._windowsLinkMatchId && this._terminal !== undefined) {
          this._terminal.deregisterLinkMatcher(this._linuxLinkMatcherId);
          this._terminal.deregisterLinkMatcher(this._windowsLinkMatchId);
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
