import { localize } from '@opensumi/ide-core-common';

import { registerColor, transparent } from '../utils';

import { contrastBorder } from './base';

// < --- Title Bar --- >

export const TITLE_BAR_ACTIVE_FOREGROUND = registerColor(
  'titleBar.activeForeground',
  {
    dark: '#CCCCCC',
    light: '#333333',
    hcDark: '#FFFFFF',
    hcLight: '#292929',
  },
  localize('titleBarActiveForeground', 'Title bar foreground when the window is active.'),
);

export const TITLE_BAR_INACTIVE_FOREGROUND = registerColor(
  'titleBar.inactiveForeground',
  {
    dark: transparent(TITLE_BAR_ACTIVE_FOREGROUND, 0.6),
    light: transparent(TITLE_BAR_ACTIVE_FOREGROUND, 0.6),
    hcDark: null,
    hcLight: '#292929',
  },
  localize('titleBarInactiveForeground', 'Title bar foreground when the window is inactive.'),
);

export const TITLE_BAR_ACTIVE_BACKGROUND = registerColor(
  'titleBar.activeBackground',
  {
    dark: '#3C3C3C',
    light: '#DDDDDD',
    hcDark: '#000000',
    hcLight: '#FFFFFF',
  },
  localize('titleBarActiveBackground', 'Title bar background when the window is active.'),
);

export const TITLE_BAR_INACTIVE_BACKGROUND = registerColor(
  'titleBar.inactiveBackground',
  {
    dark: transparent(TITLE_BAR_ACTIVE_BACKGROUND, 0.6),
    light: transparent(TITLE_BAR_ACTIVE_BACKGROUND, 0.6),
    hcDark: null,
    hcLight: null,
  },
  localize('titleBarInactiveBackground', 'Title bar background when the window is inactive.'),
);

export const TITLE_BAR_BORDER = registerColor(
  'titleBar.border',
  {
    dark: null,
    light: null,
    hcDark: contrastBorder,
    hcLight: contrastBorder,
  },
  localize('titleBarBorder', 'Title bar border color.'),
);
