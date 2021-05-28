import { Terminal, ILinkProvider } from 'xterm';
import { Injectable, Autowired } from '@ali/common-di';
import { URI, Disposable, IDisposable, DisposableCollection, isOSX, FileUri } from '@ali/ide-core-common';
import { OperatingSystem, isWindows } from '@ali/ide-core-common/lib/platform';
import { posix, win32, IPath } from '@ali/ide-core-common/lib/path';
import { IOpenerService } from '@ali/ide-core-browser';
import { IFileServiceClient } from '@ali/ide-file-service';
import { WorkbenchEditorService } from '@ali/ide-editor/lib/common';
import { TerminalProtocolLinkProvider } from './protocol-link-provider';
import { TerminalValidatedLocalLinkProvider, lineAndColumnClause, unixLocalLinkClause, winLocalLinkClause, winDrivePrefix, winLineAndColumnMatchIndex, unixLineAndColumnMatchIndex, lineAndColumnClauseGroupCount } from './validated-local-link-provider';
import { TerminalExternalLinkProviderAdapter } from './external-link-provider-adapter';
import { ITerminalClient, ITerminalExternalLinkProvider } from '../../common';
import { TerminalClient } from '../terminal.client';

export type XtermLinkMatcherHandler = (event: MouseEvent | undefined, link: string) => Promise<void>;

export interface ITextEditorSelection {
  readonly startLineNumber: number;
  readonly startColumn: number;
  readonly endLineNumber?: number;
  readonly endColumn?: number;
}

/**
 * An object responsible for managing registration of link matchers and link providers.
 */
@Injectable({ multiple: true })
export class TerminalLinkManager extends Disposable {
  private _processCwd: string | undefined;
  private _standardLinkProviders: ILinkProvider[] = [];
  private _standardLinkProvidersDisposables = new DisposableCollection();

  @Autowired()
  private _editorService: WorkbenchEditorService;

  @Autowired(IOpenerService)
  private _openerService: IOpenerService;

  @Autowired(IFileServiceClient)
  private _fileService: IFileServiceClient;

  @Autowired(IFileServiceClient)
  private readonly _fileSystem: IFileServiceClient;

  private _getHomeDirPromise: Promise<string>;

  constructor(
    private _xterm: Terminal,
    private _client: TerminalClient,
  ) {
    super();

    // Protocol links
    const wrappedActivateCallback = this._wrapLinkHandler((_, link) => this._handleProtocolLink(link));
    const protocolProvider = new TerminalProtocolLinkProvider(this._xterm, wrappedActivateCallback);
    this._standardLinkProviders.push(protocolProvider);

    // Validated local links
    const wrappedTextLinkActivateCallback = this._wrapLinkHandler((_, link) => this._handleLocalLink(link));
    const validatedProvider = new TerminalValidatedLocalLinkProvider(
      this._xterm,
      this._client,
      wrappedTextLinkActivateCallback,
      this._wrapLinkHandler.bind(this),
      async (link, cb) => cb(await this._resolvePath(link)),
    );
    this._standardLinkProviders.push(validatedProvider);

    this._registerStandardLinkProviders();
  }

  public set processCwd(processCwd: string) {
    this._processCwd = processCwd;
  }

  private _registerStandardLinkProviders(): void {
    this._standardLinkProvidersDisposables.dispose();
    this._standardLinkProvidersDisposables = new DisposableCollection();
    for (const p of this._standardLinkProviders) {
      this._standardLinkProvidersDisposables.push(this._xterm.registerLinkProvider(p));
    }
  }

  public registerExternalLinkProvider(instance: ITerminalClient, linkProvider: ITerminalExternalLinkProvider): IDisposable {
    const wrappedLinkProvider = new TerminalExternalLinkProviderAdapter(this._xterm, instance, linkProvider, this._wrapLinkHandler.bind(this));
    const newLinkProvider = this._xterm.registerLinkProvider(wrappedLinkProvider);
    // Re-register the standard link providers so they are a lower priority that the new one
    this._registerStandardLinkProviders();
    return newLinkProvider;
  }

  protected _wrapLinkHandler(handler: (event: MouseEvent | undefined, link: string) => void): XtermLinkMatcherHandler {
    return async (event: MouseEvent | undefined, link: string) => {
      // Prevent default electron link handling so Alt+Click mode works normally
      event?.preventDefault();

      // Require correct modifier on click
      if (event && !this._isLinkActivationModifierDown(event)) {
        return;
      }

      // Just call the handler if there is no before listener
      handler(event, link);
    };
  }

  protected get _localLinkRegex(): RegExp {
    const baseLocalLinkClause = this._client.os === OperatingSystem.Windows ? winLocalLinkClause : unixLocalLinkClause;
    // Append line and column number regex
    return new RegExp(`${baseLocalLinkClause}(${lineAndColumnClause})`);
  }

  private async _handleLocalLink(link: string): Promise<void> {
    // TODO: This gets resolved again but doesn't need to as it's already validated
    const resolvedLink = await this._resolvePath(link);
    if (!resolvedLink) {
      return;
    }
    const lineColumnInfo: LineColumnInfo = this.extractLineColumnInfo(link);
    const range: ITextEditorSelection = {
      startLineNumber: lineColumnInfo.lineNumber,
      endLineNumber: lineColumnInfo.lineNumber,
      startColumn: lineColumnInfo.columnNumber,
      endColumn: lineColumnInfo.columnNumber,
    };
    await this._editorService.open(resolvedLink.uri, { range });
  }

  private _handleHypertextLink(url: string): void {
    this._openerService.open(url);
  }

  private async _handleProtocolLink(link: string): Promise<void> {
    // Check if it's a file:/// link, hand off to local link handler so to open an editor and
    // respect line/col attachment
    const uri = URI.parse(link);
    if (uri.scheme === 'file') {
      // Just using fsPath here is unsafe: https://github.com/microsoft/vscode/issues/109076
      // fsPath 是基于当前环境判断 sep 的，连接远程服务时，如果当前系统为 Windows，
      // 而 uri 来自远程 Linux，则会出现生成的链接 sep 不正确，导致打开文件失败。
      const fsPath = FileUri.fsPath(uri);
      this._handleLocalLink(((this._client.os !== OperatingSystem.Windows) && isWindows) ? fsPath.replace(/\\/g, posix.sep) : fsPath);
      return;
    }

    // Open as a web link if it's not a file
    this._handleHypertextLink(link);
  }

  protected _isLinkActivationModifierDown(event: MouseEvent): boolean {
    return isOSX ? event.metaKey : event.ctrlKey;
  }

  private get osPath(): IPath {
    if (this._client.os === OperatingSystem.Windows) {
      return win32;
    }
    return posix;
  }

  /**
   * 获取用户目录
   */
  private async _getUserHomeDir(): Promise<string> {
    const homeDirStat = await this._fileSystem.getCurrentUserHome();
    if (!homeDirStat) {
      throw new Error('Unable to get user home directory');
    }
    const homeDirPath = await this._fileSystem.getFsPath(homeDirStat.uri);
    return homeDirPath!;
  }

  private _getUserHomeDirOnce(): Promise<string> {
    if (!this._getHomeDirPromise) {
      this._getHomeDirPromise = this._getUserHomeDir();
    }
    return this._getHomeDirPromise;
  }

  protected async _preprocessPath(link: string): Promise<string | null> {
    if (link.charAt(0) === '~') {
      // Resolve ~ -> userHome
      const userHome = await this._getUserHomeDirOnce();
      if (!userHome) {
        return null;
      }
      link = this.osPath.join(userHome, link.substring(1));
    } else if (link.charAt(0) !== '/' && link.charAt(0) !== '~') {
      // Resolve workspace path . | .. | <relative_path> -> <path>/. | <path>/.. | <path>/<relative_path>
      if (this._client.os === OperatingSystem.Windows) {
        if (!link.match('^' + winDrivePrefix) && !link.startsWith('\\\\?\\')) {
          if (!this._processCwd) {
            // Abort if no workspace is open
            return null;
          }
          link = this.osPath.join(this._processCwd, link);
        } else {
          // Remove \\?\ from paths so that they share the same underlying
          // uri and don't open multiple tabs for the same file
          link = link.replace(/^\\\\\?\\/, '');
        }
      } else {
        if (!this._processCwd) {
          // Abort if no workspace is open
          return null;
        }
        link = this.osPath.join(this._processCwd, link);
      }
    }
    link = this.osPath.normalize(link);

    return link;
  }

  private async _resolvePath(link: string): Promise<{ uri: URI, isDirectory: boolean } | undefined> {
    const preprocessedLink = await this._preprocessPath(link);
    if (!preprocessedLink) {
      return undefined;
    }

    const linkUrl = this.extractLinkUrl(preprocessedLink);
    if (!linkUrl) {
      return undefined;
    }

    try {
      const uri = URI.file(linkUrl);
      const stat = await this._fileService.getFileStat(uri.toString());
      if (stat) {
        return { uri, isDirectory: stat.isDirectory };
      }
    } catch {
      // Errors in parsing the path
      return undefined;
    }
  }

  /**
   * Returns line and column number of URl if that is present.
   *
   * @param link Url link which may contain line and column number.
   */
  public extractLineColumnInfo(link: string): LineColumnInfo {
    const matches: string[] | null = this._localLinkRegex.exec(link);
    const lineColumnInfo: LineColumnInfo = {
      lineNumber: 1,
      columnNumber: 1,
    };

    if (!matches) {
      return lineColumnInfo;
    }

    const lineAndColumnMatchIndex = this._client.os === OperatingSystem.Windows ? winLineAndColumnMatchIndex : unixLineAndColumnMatchIndex;
    for (let i = 0; i < lineAndColumnClause.length; i++) {
      const lineMatchIndex = lineAndColumnMatchIndex + (lineAndColumnClauseGroupCount * i);
      const rowNumber = matches[lineMatchIndex];
      if (rowNumber) {
        lineColumnInfo['lineNumber'] = parseInt(rowNumber, 10);
        // Check if column number exists
        const columnNumber = matches[lineMatchIndex + 2];
        if (columnNumber) {
          lineColumnInfo['columnNumber'] = parseInt(columnNumber, 10);
        }
        break;
      }
    }

    return lineColumnInfo;
  }

  /**
   * Returns url from link as link may contain line and column information.
   *
   * @param link url link which may contain line and column number.
   */
  public extractLinkUrl(link: string): string | null {
    const matches: string[] | null = this._localLinkRegex.exec(link);
    if (!matches) {
      return null;
    }
    return matches[1];
  }
}

export interface LineColumnInfo {
  lineNumber: number;
  columnNumber: number;
}
