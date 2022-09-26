import { localize } from '@opensumi/ide-core-common';

import { Color, RGBA } from '../color';
import { registerColor } from '../utils';

import { editorWidgetBackground, editorWidgetForeground } from './editor';

export const quickInputBackground = registerColor(
  'quickInput.background',
  {
    dark: editorWidgetBackground,
    light: editorWidgetBackground,
    hcDark: editorWidgetBackground,
    hcLight: editorWidgetBackground,
  },
  localize(
    'pickerBackground',
    'Quick picker background color. The quick picker widget is the container for pickers like the command palette.',
  ),
);
export const quickInputForeground = registerColor(
  'quickInput.foreground',
  {
    dark: editorWidgetForeground,
    light: editorWidgetForeground,
    hcDark: editorWidgetForeground,
    hcLight: editorWidgetForeground,
  },
  localize(
    'pickerForeground',
    'Quick picker foreground color. The quick picker widget is the container for pickers like the command palette.',
  ),
);
export const quickInputTitleBackground = registerColor(
  'quickInputTitle.background',
  {
    dark: new Color(new RGBA(255, 255, 255, 0.105)),
    light: new Color(new RGBA(0, 0, 0, 0.06)),
    hcDark: '#000000',
    hcLight: Color.white,
  },
  localize(
    'pickerTitleBackground',
    'Quick picker title background color. The quick picker widget is the container for pickers like the command palette.',
  ),
);

export const TITLE_BAR_BACKGROUND = registerColor(
  'titlebar.background',
  {
    dark: '#383838',
    light: '#383838',
    hcDark: '#383838',
    hcLight: '#383838',
  },
  localize('titlebarBackgound', 'Titlebar background color.'),
);
