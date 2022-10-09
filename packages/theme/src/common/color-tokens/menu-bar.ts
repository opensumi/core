import { localize } from '@opensumi/ide-core-common';

import { Color } from '../../common/color';
import { transparent, registerColor } from '../utils';

import { activeContrastBorder } from './base';
import { TITLE_BAR_ACTIVE_FOREGROUND } from './title-bar';
import { toolbarHoverBackground } from './toolbar';

// < --- Menubar --- >

export const MENUBAR_SELECTION_FOREGROUND = registerColor(
  'menubar.selectionForeground',
  {
    dark: TITLE_BAR_ACTIVE_FOREGROUND,
    light: TITLE_BAR_ACTIVE_FOREGROUND,
    hcDark: TITLE_BAR_ACTIVE_FOREGROUND,
    hcLight: TITLE_BAR_ACTIVE_FOREGROUND,
  },
  localize('menubarSelectionForeground', 'Foreground color of the selected menu item in the menubar.'),
);

export const MENUBAR_SELECTION_BACKGROUND = registerColor(
  'menubar.selectionBackground',
  {
    dark: toolbarHoverBackground,
    light: toolbarHoverBackground,
    hcDark: null,
    hcLight: null,
  },
  localize('menubarSelectionBackground', 'Background color of the selected menu item in the menubar.'),
);

export const MENUBAR_SELECTION_BORDER = registerColor(
  'menubar.selectionBorder',
  {
    dark: null,
    light: null,
    hcDark: activeContrastBorder,
    hcLight: activeContrastBorder,
  },
  localize('menubarSelectionBorder', 'Border color of the selected menu item in the menubar.'),
);
