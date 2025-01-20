import { IBufferLine, Terminal } from '@xterm/xterm';

import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { PrefixQuickOpenService } from '@opensumi/ide-core-browser/lib/quick-open';
import { AppConfig } from '@opensumi/ide-core-browser/lib/react-providers/config-provider';
import { IWindowService } from '@opensumi/ide-core-browser/lib/window';
import { URI } from '@opensumi/ide-core-common';
import { CommandService } from '@opensumi/ide-core-common/lib/command';
import { IWorkspaceService } from '@opensumi/ide-workspace/lib/common/workspace.interface';

import { escapeRegExpCharacters } from '../terminal.typeAhead.addon';

import { TerminalBaseLinkProvider } from './base';
import { convertLinkRangeToBuffer, getXtermLineContent } from './helpers';
import { TerminalLink } from './link';

export const USUAL_WORD_SEPARATORS = ' ()[]{}\',"`─‘’“”|';

interface Word {
  startIndex: number;
  endIndex: number;
  text: string;
}

@Injectable({ multiple: true })
export class TerminalWordLinkProvider extends TerminalBaseLinkProvider {
  private _separatorRegex!: RegExp;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(IWindowService)
  protected readonly windowService: IWindowService;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(PrefixQuickOpenService)
  protected readonly quickOpenService: PrefixQuickOpenService;

  constructor(
    private readonly _xterm: Terminal,
    private readonly _validationCallback: (
      link: string,
      callback: (result: { uri: URI; isDirectory: boolean } | undefined) => void,
    ) => void,
    private readonly _activateFileCallback: (event: MouseEvent | undefined, link: string) => void,
  ) {
    super();
    this._refreshSeparatorCodes();
  }

  private _refreshSeparatorCodes(): void {
    let powerlineSymbols = '';
    for (let i = 0xe0b0; i <= 0xe0bf; i++) {
      powerlineSymbols += String.fromCharCode(i);
    }
    this._separatorRegex = new RegExp(`[${escapeRegExpCharacters(USUAL_WORD_SEPARATORS)}${powerlineSymbols}]`, 'g');
  }

  protected _provideLinks(bufferLineNumber: number): Promise<TerminalLink[]> | TerminalLink[] {
    const links: TerminalLink[] = [];
    const startLine = bufferLineNumber - 1;
    const endLine = startLine;

    const lines: IBufferLine[] = [this._xterm.buffer.active.getLine(startLine)!];

    const text = getXtermLineContent(this._xterm.buffer.active, startLine, endLine, this._xterm.cols);
    if (text === '' || text.length > 1024) {
      return [];
    }

    // Parse out all words from the wrapped line
    const words: Word[] = this._parseWords(text);

    // Map the words to ITerminalLink objects
    for (const word of words) {
      if (word.text === '') {
        continue;
      }

      if (word.text.length > 0 && word.text.charAt(word.text.length - 1) === ':') {
        word.text = word.text.slice(0, -1);
        word.endIndex--;
      }

      const bufferRange = convertLinkRangeToBuffer(
        lines,
        this._xterm.cols,
        {
          startColumn: word.startIndex + 1,
          startLineNumber: 1,
          endColumn: word.endIndex + 1,
          endLineNumber: 1,
        },
        startLine,
      );

      // Search links
      const activateHandler = (event: MouseEvent | undefined, text: string) => {
        this._validationCallback(text, async (result) => {
          if (result) {
            if (result.isDirectory) {
              this._handleLocalFolderLink(result.uri);
            } else {
              this._activateFileCallback(event, text);
            }
          } else {
            this.quickOpenService.open(text);
          }
        });
      };

      links.push(
        this.injector.get(TerminalLink, [
          this._xterm,
          bufferRange,
          word.text,
          this._xterm.buffer.active.viewportY,
          activateHandler,
          undefined,
          true,
          word.text,
        ]),
      );
    }

    return links;
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

  private _parseWords(text: string): Word[] {
    const words: Word[] = [];
    const splitWords = text.split(this._separatorRegex);
    let runningIndex = 0;
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < splitWords.length; i++) {
      words.push({
        text: splitWords[i],
        startIndex: runningIndex,
        endIndex: runningIndex + splitWords[i].length,
      });
      runningIndex += splitWords[i].length + 1;
    }
    return words;
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
