import { Terminal, ILinkProvider, IViewportRange } from 'xterm';

import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { IOpenerService, PreferenceService } from '@opensumi/ide-core-browser';
import {
  URI,
  Disposable,
  IDisposable,
  DisposableCollection,
  isOSX,
  FileUri,
  localize,
} from '@opensumi/ide-core-common';
import { posix, win32, IPath } from '@opensumi/ide-core-common/lib/path';
import { OperatingSystem, isWindows, isMacintosh } from '@opensumi/ide-core-common/lib/platform';
import { WorkbenchEditorService } from '@opensumi/ide-editor/lib/common';
import { IFileServiceClient } from '@opensumi/ide-file-service';

import { ITerminalClient, ITerminalExternalLinkProvider, ITerminalHoverManagerService } from '../../common';
import { XTermCore } from '../../common/xterm-private';
import { TerminalClient } from '../terminal.client';

import { TerminalExternalLinkProviderAdapter } from './external-link-provider-adapter';
import { TerminalLink } from './link';
import { TerminalProtocolLinkProvider } from './protocol-link-provider';
import {
  TerminalValidatedLocalLinkProvider,
  lineAndColumnClause,
  unixLocalLinkClause,
  winLocalLinkClause,
  winDrivePrefix,
  winLineAndColumnMatchIndex,
  unixLineAndColumnMatchIndex,
  lineAndColumnClauseGroupCount,
} from './validated-local-link-provider';


export type XtermLinkMatcherHandler = (event: MouseEvent | undefined, link: string) => Promise<void>;

export interface ITextEditorSelection {
  readonly startLineNumber: number;
  readonly startColumn: number;
  readonly endLineNumber?: number;
  readonly endColumn?: number;
}

export interface ILinkHoverTargetOptions {
  readonly viewportRange: IViewportRange;
  readonly cellDimensions: {
    width: number;
    height: number;
  };
  readonly terminalDimensions: {
    width: number;
    height: number;
  };
  readonly boundingClientRect: {
    bottom: number;
    height: number;
    left: number;
    right: number;
    top: number;
    width: number;
    x: number;
    y: number;
  };
  readonly modifierDownCallback?: () => void;
  readonly modifierUpCallback?: () => void;
}

/**
 * An object responsible for managing registration of link matchers and link providers.
 */
@Injectable({ multiple: true })
export class TerminalLinkManager extends Disposable {
  private _processCwd: string | undefined;
  private _standardLinkProviders: ILinkProvider[] = [];
  private _standardLinkProvidersDisposables = new DisposableCollection();

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired()
  private readonly _editorService: WorkbenchEditorService;

  @Autowired(IOpenerService)
  private readonly _openerService: IOpenerService;

  @Autowired(IFileServiceClient)
  private readonly _fileService: IFileServiceClient;

  @Autowired(IFileServiceClient)
  private readonly _fileSystem: IFileServiceClient;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(ITerminalHoverManagerService)
  private readonly _hoverManager: ITerminalHoverManagerService;

  private _getHomeDirPromise: Promise<string>;

  constructor(private _xterm: Terminal, private _client: TerminalClient) {
    super();

    // Protocol links
    const wrappedActivateCallback = this._wrapLinkHandler((_, link) => this._handleProtocolLink(link));
    const protocolProvider = this.injector.get(TerminalProtocolLinkProvider, [
      this._xterm,
      wrappedActivateCallback,
      this._tooltipCallback.bind(this),
    ]);
    this._standardLinkProviders.push(protocolProvider);

    // Validated local links
    const wrappedTextLinkActivateCallback = this._wrapLinkHandler((_, link) => this._handleLocalLink(link));
    const validatedProvider = this.injector.get(TerminalValidatedLocalLinkProvider, [
      this._xterm,
      this._client,
      wrappedTextLinkActivateCallback,
      this._wrapLinkHandler.bind(this),
      this._tooltipCallback.bind(this),
      async (link, cb) => cb(await this._resolvePath(link)),
    ]);
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

  private _tooltipCallback(
    link: TerminalLink,
    viewportRange: IViewportRange,
    modifierDownCallback?: () => void,
    modifierUpCallback?: () => void,
  ) {
    const core = (this._xterm as any)._core as XTermCore;
    const cellDimensions = {
      width: core._renderService.dimensions.actualCellWidth,
      height: core._renderService.dimensions.actualCellHeight,
    };
    const terminalDimensions = {
      width: this._xterm.cols,
      height: this._xterm.rows,
    };
    const boundingClientRect = core.element.getBoundingClientRect();

    // Don't pass the mouse event as this avoids the modifier check
    return this._showHover(
      {
        viewportRange,
        cellDimensions,
        terminalDimensions,
        boundingClientRect,
        modifierDownCallback,
        modifierUpCallback,
      },
      this._getLinkHoverString(link.text, link.label),
      (text) => link.activate(undefined, text),
      link,
    );
  }

  private _showHover(
    targetOptions: ILinkHoverTargetOptions,
    text: string,
    linkHandler: (url: string) => void,
    link?: TerminalLink,
  ) {
    const attached = this._hoverManager.showHover(targetOptions, text, linkHandler);
    link?.onInvalidated(() => attached.dispose());

    return Disposable.create(() => attached.dispose());
  }

  public registerExternalLinkProvider(
    instance: ITerminalClient,
    linkProvider: ITerminalExternalLinkProvider,
  ): IDisposable {
    const wrappedLinkProvider = this.injector.get(TerminalExternalLinkProviderAdapter, [
      this._xterm,
      instance,
      linkProvider,
      this._wrapLinkHandler.bind(this),
      this._tooltipCallback.bind(this),
    ]);
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
      this._handleLocalLink(
        this._client.os !== OperatingSystem.Windows && isWindows ? fsPath.replace(/\\/g, posix.sep) : fsPath,
      );
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

  private _getLinkHoverString(uri: string, label: string | undefined): string {
    const multiCursorModifier = this.preferenceService.get<'ctrlCmd' | 'alt'>('editor.multiCursorModifier');

    let clickLabel = '';
    if (multiCursorModifier === 'ctrlCmd') {
      if (isMacintosh) {
        clickLabel = localize('terminalLinkHandler.followLinkAlt.mac', 'option + click');
      } else {
        clickLabel = localize('terminalLinkHandler.followLinkAlt', 'alt + click');
      }
    } else {
      if (isMacintosh) {
        clickLabel = localize('terminalLinkHandler.followLinkCmd', 'cmd + click');
      } else {
        clickLabel = localize('terminalLinkHandler.followLinkCtrl', 'ctrl + click');
      }
    }

    const fallbackLabel = localize('followLink', 'Follow link');
    label = label || fallbackLabel;

    return `${label} (${clickLabel})`;
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

  private async _resolvePath(link: string): Promise<{ uri: URI; isDirectory: boolean } | undefined> {
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

    const lineAndColumnMatchIndex =
      this._client.os === OperatingSystem.Windows ? winLineAndColumnMatchIndex : unixLineAndColumnMatchIndex;
    for (let i = 0; i < lineAndColumnClause.length; i++) {
      const lineMatchIndex = lineAndColumnMatchIndex + lineAndColumnClauseGroupCount * i;
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
