import { Injectable } from '@ali/common-di';
import { Themable } from '@ali/ide-theme/lib/browser/workbench.theme.service';
import { Color } from '@ali/ide-theme/lib/common/color';
import { ITerminalTheme } from '../common';
import * as TERMINAL_COLOR from './terminal.color';

@Injectable()
export class TerminalTheme extends Themable implements ITerminalTheme {
  get terminalTheme(): any {
    const termBgColor = this.getColorSync(TERMINAL_COLOR.TERMINAL_BACKGROUND_COLOR);
    const termFgColor = this.getColorSync(TERMINAL_COLOR.TERMINAL_FOREGROUND_COLOR);
    const termSelectionColor = this.getColorSync(TERMINAL_COLOR.TERMINAL_SELECTION_BACKGROUND_COLOR);
    const termCursorColor = this.getColorSync(TERMINAL_COLOR.TERMINAL_CURSOR_FOREGROUND_COLOR) || termFgColor;
    const termCursorAccentColor = this.getColorSync(TERMINAL_COLOR.TERMINAL_CURSOR_BACKGROUND_COLOR) || termBgColor;

    const ansiColorMap = TERMINAL_COLOR.ansiColorMap;

    if (!(termBgColor && termFgColor && termSelectionColor && termCursorColor && termCursorAccentColor)) {
      // 因为有 fallback，这段逻辑应该不会被执行
      throw new Error('terminal color undefined');
    }

    return {
      background: Color.Format.CSS.formatHexA(termBgColor),
      foreground: Color.Format.CSS.formatHexA(termFgColor),
      selection: Color.Format.CSS.formatHexA(termSelectionColor),
      cursor: Color.Format.CSS.formatHexA(termCursorColor),
      cursorAccent: Color.Format.CSS.formatHexA(termCursorAccentColor),
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
