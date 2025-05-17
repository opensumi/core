/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Some code copied and modified from https://github.com/microsoft/vscode/blob/1.63.2/src/vs/workbench/contrib/terminal/browser/links/terminalValidatedLocalLinkProvider.ts

import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { AppConfig } from '@opensumi/ide-core-browser/lib/react-providers/config-provider';
import { IWindowService } from '@opensumi/ide-core-browser/lib/window';
import { CommandService, FileUri, IDisposable, OperatingSystem, URI } from '@opensumi/ide-core-common';
import { IWorkspaceService } from '@opensumi/ide-workspace/lib/common/workspace.interface';

import {
  ILinkInfo,
  MAX_LENGTH,
  extractLineInfoFromMatch,
  getLineAndColumnClause,
  unixLocalLinkClause,
  winLocalLinkClause,
} from '../../common/terminal-link';

import { TerminalBaseLinkProvider } from './base';
import { convertLinkRangeToBuffer, getXtermLineContent } from './helpers';
import { FOLDER_IN_WORKSPACE_LABEL, FOLDER_NOT_IN_WORKSPACE_LABEL, OPEN_FILE_LABEL, TerminalLink } from './link';
import { XtermLinkMatcherHandler } from './link-manager';

import type { TerminalClient } from '../terminal.client';
import type { IBufferLine, IViewportRange, Terminal } from '@xterm/xterm';

@Injectable({ multiple: true })
export class TerminalValidatedLocalLinkProvider extends TerminalBaseLinkProvider {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(IWindowService)
  protected readonly windowService: IWindowService;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  constructor(
    private readonly _xterm: Terminal,
    private readonly _client: TerminalClient,
    private readonly _activateFileCallback: (event: MouseEvent | undefined, link: string) => void,
    private readonly _wrapLinkHandler: (
      handler: (event: MouseEvent | undefined, link: string) => void,
    ) => XtermLinkMatcherHandler,
    private readonly _tooltipCallback: (
      link: TerminalLink,
      viewportRange: IViewportRange,
      modifierDownCallback?: () => void,
      modifierUpCallback?: () => void,
    ) => IDisposable,
    private readonly _validationCallback: (
      link: string,
      callback: (result: { uri: URI; isDirectory: boolean } | undefined) => void,
    ) => void,
  ) {
    super();
  }

  protected async _provideLinks(y: number): Promise<TerminalLink[]> {
    const result: TerminalLink[] = [];
    let startLine = y - 1;
    let endLine = startLine;

    const lines: IBufferLine[] = [this._xterm.buffer.active.getLine(startLine)!];

    while (startLine >= 0 && this._xterm.buffer.active.getLine(startLine)?.isWrapped) {
      lines.unshift(this._xterm.buffer.active.getLine(startLine - 1)!);
      startLine--;
    }

    while (endLine < this._xterm.buffer.active.length && this._xterm.buffer.active.getLine(endLine + 1)?.isWrapped) {
      lines.push(this._xterm.buffer.active.getLine(endLine + 1)!);
      endLine++;
    }

    const text = getXtermLineContent(this._xterm.buffer.active, startLine, endLine, this._xterm.cols);
    if (text.length > MAX_LENGTH) {
      return [];
    }

    // clone regex to do a global search on text
    const rex = new RegExp(this._localLinkRegex, 'g');
    let match;
    let stringIndex = -1;
    while ((match = rex.exec(text)) !== null) {
      let link = match[0];
      if (!link) {
        // something matched but does not comply with the given matchIndex
        // since this is most likely a bug the regex itself we simply do nothing here
        // this._logService.debug('match found without corresponding matchIndex', match, matcher);
        break;
      }

      // Get index, match.index is for the outer match which includes negated chars
      // therefore we cannot use match.index directly, instead we search the position
      // of the match group in text again
      // also correct regex and string search offsets for the next loop run
      stringIndex = text.indexOf(link, stringIndex + 1);
      rex.lastIndex = stringIndex + link.length;
      if (stringIndex < 0) {
        // invalid stringIndex (should not have happened)
        break;
      }

      // Adjust the link range to exclude a/ and b/ if it looks like a git diff
      if (
        // --- a/foo/bar
        // +++ b/foo/bar
        ((text.startsWith('--- a/') || text.startsWith('+++ b/')) && stringIndex === 4) ||
        // diff --git a/foo/bar b/foo/bar
        (text.startsWith('diff --git') && (link.startsWith('a/') || link.startsWith('b/')))
      ) {
        link = link.substring(2);
        stringIndex += 2;
      }
      // 从匹配结果中提取行号信息
      const lineInfo = this._extractLineInfoFromMatch(match);
      const validatedLinks = await this.detectLocalLink(link, lines, startLine, stringIndex, 1, lineInfo);

      if (validatedLinks.length > 0) {
        result.push(...validatedLinks);
      }
    }

    return result;
  }

  private _extractLineInfoFromMatch(match: RegExpExecArray): ILinkInfo {
    return extractLineInfoFromMatch(match);
  }

  protected get _localLinkRegex(): RegExp {
    const baseLocalLinkClause = this._client.os === OperatingSystem.Windows ? winLocalLinkClause : unixLocalLinkClause;
    // Append line and column number regex
    return new RegExp(`(${baseLocalLinkClause})(${getLineAndColumnClause()})?`);
  }

  private async detectLocalLink(
    text: string,
    bufferLines: IBufferLine[],
    startLine: number,
    stringIndex: number,
    offset,
    lineInfo?: ILinkInfo,
  ) {
    const result: TerminalLink[] = [];

    const validatedLink = await new Promise<TerminalLink | undefined>((r) => {
      // 使用匹配到的文件路径
      const filePath = text.match(this._localLinkRegex)?.[1] || text;
      // 如果是 file:/// 协议，转换为本地路径
      const localPath = filePath.startsWith('file://') ? FileUri.fsPath(URI.parse(filePath)) : filePath;

      this._validationCallback(localPath, async (result) => {
        if (result) {
          const label = result.isDirectory
            ? (await this._isDirectoryInsideWorkspace(result.uri))
              ? FOLDER_IN_WORKSPACE_LABEL
              : FOLDER_NOT_IN_WORKSPACE_LABEL
            : OPEN_FILE_LABEL;
          const activateCallback = this._wrapLinkHandler((event: MouseEvent | undefined, text: string) => {
            if (result.isDirectory) {
              this._handleLocalFolderLink(result.uri);
            } else {
              this._activateFileCallback(event, text);
            }
          });

          // Convert the link text's string index into a wrapped buffer range
          const bufferRange = convertLinkRangeToBuffer(
            bufferLines,
            this._xterm.cols,
            {
              startColumn: stringIndex + 1,
              startLineNumber: 1,
              endColumn: stringIndex + text.length + offset,
              endLineNumber: 1,
            },
            startLine,
          );

          const tooltipCallback = (
            link: TerminalLink,
            viewportRange: IViewportRange,
            modifierDownCallback?: () => void,
            modifierUpCallback?: () => void,
          ) => this._tooltipCallback(link, viewportRange, modifierDownCallback, modifierUpCallback);

          r(
            this.injector.get(TerminalLink, [
              this._xterm,
              bufferRange,
              text,
              this._xterm.buffer.active.viewportY,
              activateCallback,
              tooltipCallback,
              true,
              label,
              lineInfo,
            ]),
          );
        } else {
          r(undefined);
        }
      });
    });

    if (validatedLink) {
      result.push(validatedLink);
    }
    return result;
  }

  private async _handleLocalFolderLink(uri: URI): Promise<void> {
    // If the folder is within one of the window's workspaces, focus it in the explorer
    if (await this._isDirectoryInsideWorkspace(uri)) {
      await this.commandService.executeCommand('revealInExplorer', uri);
      return;
    }

    // Open a new window for the folder
    if (this.appConfig.isElectronRenderer) {
      this.windowService.openWorkspace(uri, { newWindow: true });
    }
  }

  private async _isDirectoryInsideWorkspace(uri: URI) {
    const folders = await this.workspaceService.roots;
    for (const folder of folders) {
      if (URI.parse(folder.uri).isEqualOrParent(uri)) {
        return true;
      }
    }
    return false;
  }
}
