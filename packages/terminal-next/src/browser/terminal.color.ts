import { localize } from '@opensumi/ide-core-common';
import {
  registerColor,
  PANEL_BACKGROUND,
  PANEL_BORDER,
  ColorIdentifier,
  ColorDefaults,
  editorFindMatch,
  editorFindMatchHighlight,
  overviewRulerFindMatchForeground,
  transparent,
} from '@opensumi/ide-theme';

// copied from vscode terminal color registry

/**
 * The color identifiers for the terminal's ansi colors. The index in the array corresponds to the index
 * of the color in the terminal color table.
 */
export const ansiColorIdentifiers: ColorIdentifier[] = [];

export const TERMINAL_BACKGROUND_COLOR = registerColor(
  'terminal.background',
  {
    dark: PANEL_BACKGROUND,
    light: PANEL_BACKGROUND,
    hc: PANEL_BACKGROUND,
  },
  localize(
    'terminal.background',
    'The background color of the terminal, this allows coloring the terminal differently to the panel.',
  ),
);

export const TERMINAL_FOREGROUND_COLOR = registerColor(
  'terminal.foreground',
  {
    light: '#333333',
    dark: '#CCCCCC',
    hc: '#FFFFFF',
  },
  localize('terminal.foreground', 'The foreground color of the terminal.'),
);
export const TERMINAL_CURSOR_FOREGROUND_COLOR = registerColor(
  'terminalCursor.foreground',
  null,
  localize('terminalCursor.foreground', 'The foreground color of the terminal cursor.'),
);

export const TERMINAL_CURSOR_BACKGROUND_COLOR = registerColor(
  'terminalCursor.background',
  null,
  localize(
    'terminalCursor.background',
    'The background color of the terminal cursor. Allows customizing the color of a character overlapped by a block cursor.',
  ),
);

export const TERMINAL_SELECTION_BACKGROUND_COLOR = registerColor(
  'terminal.selectionBackground',
  {
    light: '#00000040',
    dark: '#FFFFFF40',
    hc: '#FFFFFF80',
  },
  localize('terminal.selectionBackground', 'The selection background color of the terminal.'),
);

export const TERMINAL_SELECTION_FOREGROUND_COLOR = registerColor(
  'terminal.selectionForeground',
  {
    light: null,
    dark: null,
    hc: '#000000',
  },
  localize(
    'terminal.selectionForeground',
    'The selection foreground color of the terminal. When this is null the selection foreground will be retained and have the minimum contrast ratio feature applied.',
  ),
);

export const TERMINAL_INACTIVE_SELECTION_BACKGROUND_COLOR = registerColor(
  'terminal.inactiveSelectionBackground',
  {
    light: transparent(TERMINAL_SELECTION_BACKGROUND_COLOR, 0.5),
    dark: transparent(TERMINAL_SELECTION_BACKGROUND_COLOR, 0.5),
    hc: transparent(TERMINAL_SELECTION_BACKGROUND_COLOR, 0.7),
  },
  localize(
    'terminal.inactiveSelectionBackground',
    'The selection background color of the terminal when it does not have focus.',
  ),
);

export const TERMINAL_BORDER_COLOR = registerColor(
  'terminal.border',
  {
    dark: PANEL_BORDER,
    light: PANEL_BORDER,
    hc: PANEL_BORDER,
  },
  localize(
    'terminal.border',
    'The color of the border that separates split panes within the terminal. This defaults to panel.border.',
  ),
);

export const TERMINAL_FIND_MATCH_BACKGROUND_COLOR = registerColor(
  'terminal.findMatchBackground',
  {
    dark: null,
    light: null,
    hc: null,
  },
  localize(
    'terminal.findMatchBackground',
    'Color of the current search match in the terminal. The color must not be opaque so as not to hide underlying terminal content.',
  ),
);

export const TERMINAL_FIND_MATCH_BORDER_COLOR = registerColor(
  'terminal.findMatchBorder',
  {
    dark: editorFindMatch,
    light: editorFindMatch,
    hc: null,
  },
  localize('terminal.findMatchBorder', 'Border color of the current search match in the terminal.'),
);

export const TERMINAL_FIND_MATCH_HIGHLIGHT_BACKGROUND_COLOR = registerColor(
  'terminal.findMatchHighlightBackground',
  {
    dark: null,
    light: null,
    hc: null,
  },
  localize(
    'terminal.findMatchHighlightBackground',
    'Color of the other search matches in the terminal. The color must not be opaque so as not to hide underlying terminal content.',
  ),
);

export const TERMINAL_FIND_MATCH_HIGHLIGHT_BORDER_COLOR = registerColor(
  'terminal.findMatchHighlightBorder',
  {
    dark: editorFindMatchHighlight,
    light: editorFindMatchHighlight,
    hc: null,
  },
  localize('terminal.findMatchHighlightBorder', 'Border color of the other search matches in the terminal.'),
);

export const TERMINAL_OVERVIEW_RULER_FIND_MATCH_FOREGROUND_COLOR = registerColor(
  'terminalOverviewRuler.findMatchForeground',
  {
    dark: overviewRulerFindMatchForeground,
    light: overviewRulerFindMatchForeground,
    hc: '#f38518',
  },
  localize(
    'terminalOverviewRuler.findMatchHighlightForeground',
    'Overview ruler marker color for find matches in the terminal.',
  ),
);

export const TERMINAL_OVERVIEW_RULER_CURSOR_FOREGROUND_COLOR = registerColor(
  'terminalOverviewRuler.cursorForeground',
  {
    dark: '#A0A0A0CC',
    light: '#A0A0A0CC',
    hc: null,
  },
  localize('terminalOverviewRuler.cursorForeground', 'The overview ruler cursor color.'),
);

export const ansiColorMap: { [key: string]: { index: number; defaults: ColorDefaults } } = {
  'terminal.ansiBlack': {
    index: 0,
    defaults: {
      light: '#000000',
      dark: '#000000',
      hc: '#000000',
    },
  },
  'terminal.ansiRed': {
    index: 1,
    defaults: {
      light: '#cd3131',
      dark: '#cd3131',
      hc: '#cd0000',
    },
  },
  'terminal.ansiGreen': {
    index: 2,
    defaults: {
      light: '#00BC00',
      dark: '#0DBC79',
      hc: '#00cd00',
    },
  },
  'terminal.ansiYellow': {
    index: 3,
    defaults: {
      light: '#949800',
      dark: '#e5e510',
      hc: '#cdcd00',
    },
  },
  'terminal.ansiBlue': {
    index: 4,
    defaults: {
      light: '#0451a5',
      dark: '#2472c8',
      hc: '#0000ee',
    },
  },
  'terminal.ansiMagenta': {
    index: 5,
    defaults: {
      light: '#bc05bc',
      dark: '#bc3fbc',
      hc: '#cd00cd',
    },
  },
  'terminal.ansiCyan': {
    index: 6,
    defaults: {
      light: '#0598bc',
      dark: '#11a8cd',
      hc: '#00cdcd',
    },
  },
  'terminal.ansiWhite': {
    index: 7,
    defaults: {
      light: '#555555',
      dark: '#e5e5e5',
      hc: '#e5e5e5',
    },
  },
  'terminal.ansiBrightBlack': {
    index: 8,
    defaults: {
      light: '#666666',
      dark: '#666666',
      hc: '#7f7f7f',
    },
  },
  'terminal.ansiBrightRed': {
    index: 9,
    defaults: {
      light: '#cd3131',
      dark: '#f14c4c',
      hc: '#ff0000',
    },
  },
  'terminal.ansiBrightGreen': {
    index: 10,
    defaults: {
      light: '#14CE14',
      dark: '#23d18b',
      hc: '#00ff00',
    },
  },
  'terminal.ansiBrightYellow': {
    index: 11,
    defaults: {
      light: '#b5ba00',
      dark: '#f5f543',
      hc: '#ffff00',
    },
  },
  'terminal.ansiBrightBlue': {
    index: 12,
    defaults: {
      light: '#0451a5',
      dark: '#3b8eea',
      hc: '#5c5cff',
    },
  },
  'terminal.ansiBrightMagenta': {
    index: 13,
    defaults: {
      light: '#bc05bc',
      dark: '#d670d6',
      hc: '#ff00ff',
    },
  },
  'terminal.ansiBrightCyan': {
    index: 14,
    defaults: {
      light: '#0598bc',
      dark: '#29b8db',
      hc: '#00ffff',
    },
  },
  'terminal.ansiBrightWhite': {
    index: 15,
    defaults: {
      light: '#a5a5a5',
      dark: '#e5e5e5',
      hc: '#ffffff',
    },
  },
};

export function registerTerminalColors(): void {
  Object.keys(ansiColorMap).forEach((id) => {
    const entry = ansiColorMap[id];
    const colorName = id.substring(13);
    ansiColorIdentifiers[entry.index] = registerColor(
      id,
      entry.defaults,
      localize('terminal.ansiColor', "'{0}' ANSI color in the terminal.", colorName),
    );
  });
}
