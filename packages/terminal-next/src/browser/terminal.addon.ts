import { Terminal, ILinkMatcherOptions, ITerminalAddon } from 'xterm';

const linuxFilePathRegex = /((\/$|(\/?[a-zA-Z_0-9-\.]+)?(\/[a-zA-Z_0-9-\.]+)+))/;
const windowsFilePathRegex = new RegExp('(?:[a-zA-Z]\:|\\\\[\w\.]+\\[\w.$]+)\\(?:[\w]+\\)*\w([\w.])+');

export class TerminalFilePathAddon implements ITerminalAddon {
  private _linuxLinkMatcherId: number | undefined;
  private _windowsLinkMatchId: number | undefined;
  private _terminal: Terminal | undefined;

  constructor(
    private _handler: (event: MouseEvent, uri: string) => void,
    private _options: ILinkMatcherOptions = {},
  ) {
    this._options.matchIndex = 2;
    this._options.validationCallback = this._checkPathValid.bind(this);
  }

  private _checkPathValid(uri: string, callback: (valid: boolean) => void) {
    callback(true);
  }

  public activate(terminal: Terminal): void {
    this._terminal = terminal;
    this._linuxLinkMatcherId = this._terminal.registerLinkMatcher(linuxFilePathRegex, this._handler, this._options);
    this._windowsLinkMatchId = this._terminal.registerLinkMatcher(windowsFilePathRegex, this._handler, this._options);
  }

  public dispose(): void {
    if (this._linuxLinkMatcherId !== undefined && this._windowsLinkMatchId && this._terminal !== undefined) {
      this._terminal.deregisterLinkMatcher(this._linuxLinkMatcherId);
      this._terminal.deregisterCharacterJoiner(this._windowsLinkMatchId);
    }
  }
}
