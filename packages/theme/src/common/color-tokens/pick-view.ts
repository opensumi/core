import { localize } from '@opensumi/ide-core-common';

import { Color } from '../color';
import { registerColor, transparent } from '../utils';

import { activeContrastBorder, contrastBorder } from './base';
import { editorForeground, editorInfoForeground } from './editor';

export const peekViewTitleBackground = registerColor(
  'peekViewTitle.background',
  {
    dark: transparent(editorInfoForeground, 0.1),
    light: transparent(editorInfoForeground, 0.1),
    hcDark: null,
    hcLight: null,
  },
  localize('peekViewTitleBackground', 'Background color of the peek view title area.'),
);
export const peekViewTitleForeground = registerColor(
  'peekViewTitleLabel.foreground',
  { dark: Color.white, light: Color.black, hcDark: Color.white, hcLight: editorForeground },
  localize('peekViewTitleForeground', 'Color of the peek view title.'),
);
export const peekViewTitleInfoForeground = registerColor(
  'peekViewTitleDescription.foreground',
  { dark: '#ccccccb3', light: '#616161', hcDark: '#FFFFFF99', hcLight: '#292929' },
  localize('peekViewTitleInfoForeground', 'Color of the peek view title info.'),
);
export const peekViewBorder = registerColor(
  'peekView.border',
  { dark: editorInfoForeground, light: editorInfoForeground, hcDark: contrastBorder, hcLight: contrastBorder },
  localize('peekViewBorder', 'Color of the peek view borders and arrow.'),
);

export const peekViewResultsBackground = registerColor(
  'peekViewResult.background',
  { dark: '#252526', light: '#F3F3F3', hcDark: Color.black, hcLight: Color.white },
  localize('peekViewResultsBackground', 'Background color of the peek view result list.'),
);
export const peekViewResultsMatchForeground = registerColor(
  'peekViewResult.lineForeground',
  { dark: '#bbbbbb', light: '#646465', hcDark: Color.white, hcLight: editorForeground },
  localize('peekViewResultsMatchForeground', 'Foreground color for line nodes in the peek view result list.'),
);
export const peekViewResultsFileForeground = registerColor(
  'peekViewResult.fileForeground',
  { dark: Color.white, light: '#1E1E1E', hcDark: Color.white, hcLight: editorForeground },
  localize('peekViewResultsFileForeground', 'Foreground color for file nodes in the peek view result list.'),
);
export const peekViewResultsSelectionBackground = registerColor(
  'peekViewResult.selectionBackground',
  { dark: '#3399ff33', light: '#3399ff33', hcDark: null, hcLight: null },
  localize(
    'peekViewResultsSelectionBackground',
    'Background color of the selected entry in the peek view result list.',
  ),
);
export const peekViewResultsSelectionForeground = registerColor(
  'peekViewResult.selectionForeground',
  { dark: Color.white, light: '#6C6C6C', hcDark: Color.white, hcLight: editorForeground },
  localize(
    'peekViewResultsSelectionForeground',
    'Foreground color of the selected entry in the peek view result list.',
  ),
);
export const peekViewEditorBackground = registerColor(
  'peekViewEditor.background',
  { dark: '#001F33', light: '#F2F8FC', hcDark: Color.black, hcLight: Color.white },
  localize('peekViewEditorBackground', 'Background color of the peek view editor.'),
);
export const peekViewEditorGutterBackground = registerColor(
  'peekViewEditorGutter.background',
  {
    dark: peekViewEditorBackground,
    light: peekViewEditorBackground,
    hcDark: peekViewEditorBackground,
    hcLight: peekViewEditorBackground,
  },
  localize('peekViewEditorGutterBackground', 'Background color of the gutter in the peek view editor.'),
);

export const peekViewResultsMatchHighlight = registerColor(
  'peekViewResult.matchHighlightBackground',
  { dark: '#ea5c004d', light: '#ea5c004d', hcDark: null, hcLight: null },
  localize('peekViewResultsMatchHighlight', 'Match highlight color in the peek view result list.'),
);
export const peekViewEditorMatchHighlight = registerColor(
  'peekViewEditor.matchHighlightBackground',
  { dark: '#ff8f0099', light: '#f5d802de', hcDark: null, hcLight: null },
  localize('peekViewEditorMatchHighlight', 'Match highlight color in the peek view editor.'),
);
export const peekViewEditorMatchHighlightBorder = registerColor(
  'peekViewEditor.matchHighlightBorder',
  { dark: null, light: null, hcDark: activeContrastBorder, hcLight: activeContrastBorder },
  localize('peekViewEditorMatchHighlightBorder', 'Match highlight border in the peek view editor.'),
);
