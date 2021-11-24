import { Injectable } from '@opensumi/common-di';
import { Themable } from '@opensumi/ide-theme/lib/browser/workbench.theme.service';
import { Color } from '@opensumi/ide-theme/lib/common/color';
import { ITerminalTheme } from '../common';
import type { ITheme } from 'xterm';
import * as TERMINAL_COLOR from './terminal.color';

@Injectable()
export class TerminalTheme extends Themable implements ITerminalTheme {
  get terminalTheme(): ITheme {
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
      cursor: Color.Format.CSS.formatHexA(termCursorColor),
      cursorAccent: Color.Format.CSS.formatHexA(termCursorAccentColor),
      selection: Color.Format.CSS.formatHexA(termSelectionColor),
      black: ansiColorMap['terminal.ansiBlack'].defaults[this.theme.type] as string,
      red: ansiColorMap['terminal.ansiRed'].defaults[this.theme.type] as string,
      green: ansiColorMap['terminal.ansiGreen'].defaults[this.theme.type] as string,
      yellow: ansiColorMap['terminal.ansiYellow'].defaults[this.theme.type] as string,
      blue: ansiColorMap['terminal.ansiBlue'].defaults[this.theme.type] as string,
      magenta: ansiColorMap['terminal.ansiMagenta'].defaults[this.theme.type] as string,
      cyan: ansiColorMap['terminal.ansiCyan'].defaults[this.theme.type] as string,
      white: ansiColorMap['terminal.ansiWhite'].defaults[this.theme.type] as string,
      brightBlack: ansiColorMap['terminal.ansiBrightBlack'].defaults[this.theme.type] as string,
      brightRed: ansiColorMap['terminal.ansiBrightRed'].defaults[this.theme.type] as string,
      brightGreen: ansiColorMap['terminal.ansiBrightGreen'].defaults[this.theme.type] as string,
      brightYellow: ansiColorMap['terminal.ansiBrightYellow'].defaults[this.theme.type] as string,
      brightBlue: ansiColorMap['terminal.ansiBrightBlue'].defaults[this.theme.type] as string,
      brightMagenta: ansiColorMap['terminal.ansiBrightMagenta'].defaults[this.theme.type] as string,
      brightCyan: ansiColorMap['terminal.ansiBrightCyan'].defaults[this.theme.type] as string,
      brightWhite: ansiColorMap['terminal.ansiBrightWhite'].defaults[this.theme.type] as string,
    };
  }
}
