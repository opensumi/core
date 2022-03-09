import type { ITheme } from 'xterm';

import { Injectable } from '@opensumi/di';
import { Themable } from '@opensumi/ide-theme/lib/browser/workbench.theme.service';
import { Color } from '@opensumi/ide-theme/lib/common/color';

import { ITerminalTheme } from '../common';

import * as TERMINAL_COLOR from './terminal.color';

@Injectable()
export class TerminalTheme extends Themable implements ITerminalTheme {
  get terminalTheme(): ITheme {
    const termBgColor = this.getColorSync(TERMINAL_COLOR.TERMINAL_BACKGROUND_COLOR);
    const termFgColor = this.getColorSync(TERMINAL_COLOR.TERMINAL_FOREGROUND_COLOR);
    const termSelectionColor = this.getColorSync(TERMINAL_COLOR.TERMINAL_SELECTION_BACKGROUND_COLOR);
    const termCursorColor = this.getColorSync(TERMINAL_COLOR.TERMINAL_CURSOR_FOREGROUND_COLOR) || termFgColor;
    const termCursorAccentColor = this.getColorSync(TERMINAL_COLOR.TERMINAL_CURSOR_BACKGROUND_COLOR) || termBgColor;

    const ansiColorIdentifiers = TERMINAL_COLOR.ansiColorIdentifiers;

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
      black: this.getColorSync(ansiColorIdentifiers[0])?.toString(),
      red: this.getColorSync(ansiColorIdentifiers[1])?.toString(),
      green: this.getColorSync(ansiColorIdentifiers[2])?.toString(),
      yellow: this.getColorSync(ansiColorIdentifiers[3])?.toString(),
      blue: this.getColorSync(ansiColorIdentifiers[4])?.toString(),
      magenta: this.getColorSync(ansiColorIdentifiers[5])?.toString(),
      cyan: this.getColorSync(ansiColorIdentifiers[6])?.toString(),
      white: this.getColorSync(ansiColorIdentifiers[7])?.toString(),
      brightBlack: this.getColorSync(ansiColorIdentifiers[8])?.toString(),
      brightRed: this.getColorSync(ansiColorIdentifiers[9])?.toString(),
      brightGreen: this.getColorSync(ansiColorIdentifiers[10])?.toString(),
      brightYellow: this.getColorSync(ansiColorIdentifiers[11])?.toString(),
      brightBlue: this.getColorSync(ansiColorIdentifiers[12])?.toString(),
      brightMagenta: this.getColorSync(ansiColorIdentifiers[13])?.toString(),
      brightCyan: this.getColorSync(ansiColorIdentifiers[14])?.toString(),
      brightWhite: this.getColorSync(ansiColorIdentifiers[15])?.toString(),
    };
  }
}
