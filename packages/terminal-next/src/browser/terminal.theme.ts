import { ITheme } from 'xterm';
import { Injectable } from '@ali/common-di';
import { Themable } from '@ali/ide-theme/lib/browser/workbench.theme.service';
import * as TERMINAL_COLOR from './terminal.color';

export const ITerminalTheme = Symbol('ITerminalTheme');
export interface ITerminalTheme  {
  terminalTheme: ITheme;
}

@Injectable()
export class DefaultTerminalTheme extends Themable implements ITerminalTheme {
  get terminalTheme(): any {
    const termBgColor = this.getColorSync(TERMINAL_COLOR.TERMINAL_BACKGROUND_COLOR);
    const termFgColor = this.getColorSync(TERMINAL_COLOR.TERMINAL_FOREGROUND_COLOR);
    const ansiColorMap = TERMINAL_COLOR.ansiColorMap;
    return {
      background: termBgColor,
      foreground: termFgColor,
      cursor: this.getColorSync(TERMINAL_COLOR.TERMINAL_CURSOR_FOREGROUND_COLOR) || termFgColor,
      cursorAccent: this.getColorSync(TERMINAL_COLOR.TERMINAL_CURSOR_BACKGROUND_COLOR) || termBgColor,
      selection: this.getColorSync(TERMINAL_COLOR.TERMINAL_SELECTION_BACKGROUND_COLOR),
      black: ansiColorMap['terminal.ansiBlack'].defaults[this.theme.type],
      red: ansiColorMap['terminal.ansiRed'].defaults[this.theme.type],
      green: ansiColorMap['terminal.ansiGreen'].defaults[this.theme.type],
      yellow: ansiColorMap['terminal.ansiYellow'].defaults[this.theme.type],
      blue: ansiColorMap['terminal.ansiBlue'].defaults[this.theme.type],
      magenta: ansiColorMap['terminal.ansiMagenta'].defaults[this.theme.type],
      cyan: ansiColorMap['terminal.ansiCyan'].defaults[this.theme.type],
      white: ansiColorMap['terminal.ansiWhite'].defaults[this.theme.type],
      brightBlack: ansiColorMap['terminal.ansiBrightBlack'].defaults[this.theme.type],
      brightRed: ansiColorMap['terminal.ansiBrightRed'].defaults[this.theme.type],
      brightGreen: ansiColorMap['terminal.ansiBrightGreen'].defaults[this.theme.type],
      brightYellow: ansiColorMap['terminal.ansiBrightYellow'].defaults[this.theme.type],
      brightBlue: ansiColorMap['terminal.ansiBrightBlue'].defaults[this.theme.type],
      brightMagenta: ansiColorMap['terminal.ansiBrightMagenta'].defaults[this.theme.type],
      brightCyan: ansiColorMap['terminal.ansiBrightCyan'].defaults[this.theme.type],
      brightWhite: ansiColorMap['terminal.ansiBrightWhite'].defaults[this.theme.type],
    };
  }
}
