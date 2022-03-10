import { localize } from '@opensumi/ide-core-common';

import { Color } from '../color';
import { registerColor } from '../color-registry';

import { activeContrastBorder, contrastBorder } from './base';

export const peekViewTitleBackground = registerColor(
  'peekViewTitle.background',
  { dark: '#1E1E1E', light: '#FFFFFF', hc: '#0C141F' },
  localize('peekViewTitleBackground', 'Background color of the peek view title area.'),
);
export const peekViewTitleForeground = registerColor(
  'peekViewTitleLabel.foreground',
  { dark: '#FFFFFF', light: '#333333', hc: '#FFFFFF' },
  localize('peekViewTitleForeground', 'Color of the peek view title.'),
);
export const peekViewTitleInfoForeground = registerColor(
  'peekViewTitleDescription.foreground',
  { dark: '#ccccccb3', light: '#6c6c6cb3', hc: '#FFFFFF99' },
  localize('peekViewTitleInfoForeground', 'Color of the peek view title info.'),
);
export const peekViewBorder = registerColor(
  'peekView.border',
  { dark: '#007acc', light: '#007acc', hc: contrastBorder },
  localize('peekViewBorder', 'Color of the peek view borders and arrow.'),
);

export const peekViewResultsBackground = registerColor(
  'peekViewResult.background',
  { dark: '#252526', light: '#F3F3F3', hc: Color.black },
  localize('peekViewResultsBackground', 'Background color of the peek view result list.'),
);
export const peekViewResultsMatchForeground = registerColor(
  'peekViewResult.lineForeground',
  { dark: '#bbbbbb', light: '#646465', hc: Color.white },
  localize('peekViewResultsMatchForeground', 'Foreground color for line nodes in the peek view result list.'),
);
export const peekViewResultsFileForeground = registerColor(
  'peekViewResult.fileForeground',
  { dark: Color.white, light: '#1E1E1E', hc: Color.white },
  localize('peekViewResultsFileForeground', 'Foreground color for file nodes in the peek view result list.'),
);
export const peekViewResultsSelectionBackground = registerColor(
  'peekViewResult.selectionBackground',
  { dark: '#3399ff33', light: '#3399ff33', hc: null },
  localize(
    'peekViewResultsSelectionBackground',
    'Background color of the selected entry in the peek view result list.',
  ),
);
export const peekViewResultsSelectionForeground = registerColor(
  'peekViewResult.selectionForeground',
  { dark: Color.white, light: '#6C6C6C', hc: Color.white },
  localize(
    'peekViewResultsSelectionForeground',
    'Foreground color of the selected entry in the peek view result list.',
  ),
);
export const peekViewEditorBackground = registerColor(
  'peekViewEditor.background',
  { dark: '#001F33', light: '#F2F8FC', hc: Color.black },
  localize('peekViewEditorBackground', 'Background color of the peek view editor.'),
);
export const peekViewEditorGutterBackground = registerColor(
  'peekViewEditorGutter.background',
  { dark: peekViewEditorBackground, light: peekViewEditorBackground, hc: peekViewEditorBackground },
  localize('peekViewEditorGutterBackground', 'Background color of the gutter in the peek view editor.'),
);

export const peekViewResultsMatchHighlight = registerColor(
  'peekViewResult.matchHighlightBackground',
  { dark: '#ea5c004d', light: '#ea5c004d', hc: null },
  localize('peekViewResultsMatchHighlight', 'Match highlight color in the peek view result list.'),
);
export const peekViewEditorMatchHighlight = registerColor(
  'peekViewEditor.matchHighlightBackground',
  { dark: '#ff8f0099', light: '#f5d802de', hc: null },
  localize('peekViewEditorMatchHighlight', 'Match highlight color in the peek view editor.'),
);
export const peekViewEditorMatchHighlightBorder = registerColor(
  'peekViewEditor.matchHighlightBorder',
  { dark: null, light: null, hc: activeContrastBorder },
  localize('peekViewEditorMatchHighlightBorder', 'Match highlight border in the peek view editor.'),
);
