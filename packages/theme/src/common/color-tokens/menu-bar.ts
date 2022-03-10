import { localize } from '@opensumi/ide-core-common';

import { Color } from '../../common/color';
import { registerColor, transparent } from '../color-registry';

import { activeContrastBorder } from './base';
import { TITLE_BAR_ACTIVE_FOREGROUND } from './title-bar';

// < --- Menubar --- >

export const MENUBAR_SELECTION_FOREGROUND = registerColor(
  'menubar.selectionForeground',
  {
    dark: TITLE_BAR_ACTIVE_FOREGROUND,
    light: TITLE_BAR_ACTIVE_FOREGROUND,
    hc: TITLE_BAR_ACTIVE_FOREGROUND,
  },
  localize('menubarSelectionForeground', 'Foreground color of the selected menu item in the menubar.'),
);

export const MENUBAR_SELECTION_BACKGROUND = registerColor(
  'menubar.selectionBackground',
  {
    dark: transparent(Color.white, 0.1),
    light: transparent(Color.black, 0.1),
    hc: null,
  },
  localize('menubarSelectionBackground', 'Background color of the selected menu item in the menubar.'),
);

export const MENUBAR_SELECTION_BORDER = registerColor(
  'menubar.selectionBorder',
  {
    dark: null,
    light: null,
    hc: activeContrastBorder,
  },
  localize('menubarSelectionBorder', 'Border color of the selected menu item in the menubar.'),
);
