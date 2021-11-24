/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Some code copued and modified from https://github.com/microsoft/vscode/blob/1.44.0/src/vs/workbench/contrib/terminal/browser/links/terminalValidatedLocalLinkProvider.ts

import type { Terminal, IBufferLine } from 'xterm';
import { URI } from '@opensumi/ide-core-common';
import { OperatingSystem } from '@opensumi/ide-core-common/lib/platform';
import type { TerminalClient } from '../terminal.client';
import { TerminalLink } from './link';
import { XtermLinkMatcherHandler } from './link-manager';
import { TerminalBaseLinkProvider } from './base';
import { getXtermLineContent, convertLinkRangeToBuffer } from './helpers';

const pathPrefix = '(\\.\\.?|\\~)';
const pathSeparatorClause = '\\/';
// '":; are allowed in paths but they are often separators so ignore them
// Also disallow \\ to prevent a catastropic backtracking case #24798
const excludedPathCharactersClause = '[^\\0\\s!$`&*()\\[\\]\'":;\\\\]';
/** A regex that matches paths in the form /foo, ~/foo, ./foo, ../foo, foo/bar */
export const unixLocalLinkClause = '((' + pathPrefix + '|(' + excludedPathCharactersClause + ')+)?(' + pathSeparatorClause + '(' + excludedPathCharactersClause + ')+)+)';

export const winDrivePrefix = '(?:\\\\\\\\\\?\\\\)?[a-zA-Z]:';
const winPathPrefix = '(' + winDrivePrefix + '|\\.\\.?|\\~)';
const winPathSeparatorClause = '(\\\\|\\/)';
const winExcludedPathCharactersClause = '[^\\0<>\\?\\|\\/\\s!$`&*()\\[\\]\'":;]';
/** A regex that matches paths in the form \\?\c:\foo c:\foo, ~\foo, .\foo, ..\foo, foo\bar */
export const winLocalLinkClause = '((' + winPathPrefix + '|(' + winExcludedPathCharactersClause + ')+)?(' + winPathSeparatorClause + '(' + winExcludedPathCharactersClause + ')+)+)';

/** As xterm reads from DOM, space in that case is nonbreaking char ASCII code - 160,
replacing space with nonBreakningSpace or space ASCII code - 32. */
export const lineAndColumnClause = [
  '((\\S*)", line ((\\d+)( column (\\d+))?))', // "(file path)", line 45 [see #40468]
  '((\\S*)",((\\d+)(:(\\d+))?))', // "(file path)",45 [see #78205]
  '((\\S*) on line ((\\d+)(, column (\\d+))?))', // (file path) on line 8, column 13
  '((\\S*):line ((\\d+)(, column (\\d+))?))', // (file path):line 8, column 13
  '(([^\\s\\(\\)]*)(\\s?[\\(\\[](\\d+)(,\\s?(\\d+))?)[\\)\\]])', // (file path)(45), (file path) (45), (file path)(45,18), (file path) (45,18), (file path)(45, 18), (file path) (45, 18), also with []
  '(([^:\\s\\(\\)<>\'\"\\[\\]]*)(:(\\d+))?(:(\\d+))?)', // (file path):336, (file path):336:9
].join('|').replace(/ /g, `[${'\u00A0'} ]`);

// Changing any regex may effect this value, hence changes this as well if required.
export const winLineAndColumnMatchIndex = 12;
export const unixLineAndColumnMatchIndex = 11;

// Each line and column clause have 6 groups (ie no. of expressions in round brackets)
export const lineAndColumnClauseGroupCount = 6;

const MAX_LENGTH = 2000;

export class TerminalValidatedLocalLinkProvider extends TerminalBaseLinkProvider {
  constructor(
    private readonly _xterm: Terminal,
    private readonly _client: TerminalClient,
    private readonly _activateFileCallback: (event: MouseEvent | undefined, link: string) => void,
    private readonly _wrapLinkHandler: (handler: (event: MouseEvent | undefined, link: string) => void) => XtermLinkMatcherHandler,
    private readonly _validationCallback: (link: string, callback: (result: { uri: URI, isDirectory: boolean } | undefined) => void) => void,
  ) {
    super();
  }

  protected async _provideLinks(y: number): Promise<TerminalLink[]> {
    const result: TerminalLink[] = [];
    let startLine = y - 1;
    let endLine = startLine;

    const lines: IBufferLine[] = [
      this._xterm.buffer.active.getLine(startLine)!,
    ];

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
      // const link = match[typeof matcher.matchIndex !== 'number' ? 0 : matcher.matchIndex];
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

      // Convert the link text's string index into a wrapped buffer range
      const bufferRange = convertLinkRangeToBuffer(lines, this._xterm.cols, {
        startColumn: stringIndex + 1,
        startLineNumber: 1,
        endColumn: stringIndex + link.length + 1,
        endLineNumber: 1,
      }, startLine);

      const validatedLink = await new Promise<TerminalLink | undefined>((r) => {
        this._validationCallback(link, (result) => {
          if (result && !result.isDirectory) {
            const activateCallback = this._wrapLinkHandler((event: MouseEvent | undefined, text: string) => {
              this._activateFileCallback(event, text);
            });
            r(new TerminalLink(this._xterm, bufferRange, link, this._xterm.buffer.active.viewportY, activateCallback, true));
          } else {
            r(undefined);
          }
        });
      });
      if (validatedLink) {
        result.push(validatedLink);
      }
    }

    return result;
  }

  protected get _localLinkRegex(): RegExp {
    const baseLocalLinkClause = this._client.os === OperatingSystem.Windows ? winLocalLinkClause : unixLocalLinkClause;
    // Append line and column number regex
    return new RegExp(`${baseLocalLinkClause}(${lineAndColumnClause})`);
  }
}
