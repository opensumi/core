import { localize } from '@opensumi/ide-core-common';

import { registerColor, transparent } from '../color-registry';

import { contrastBorder } from './base';

// < --- Title Bar --- >

export const TITLE_BAR_ACTIVE_FOREGROUND = registerColor(
  'titleBar.activeForeground',
  {
    dark: '#CCCCCC',
    light: '#333333',
    hc: '#FFFFFF',
  },
  localize(
    'titleBarActiveForeground',
    'Title bar foreground when the window is active. Note that this color is currently only supported on macOS.',
  ),
);

export const TITLE_BAR_INACTIVE_FOREGROUND = registerColor(
  'titleBar.inactiveForeground',
  {
    dark: transparent(TITLE_BAR_ACTIVE_FOREGROUND, 0.6),
    light: transparent(TITLE_BAR_ACTIVE_FOREGROUND, 0.6),
    hc: null,
  },
  localize(
    'titleBarInactiveForeground',
    'Title bar foreground when the window is inactive. Note that this color is currently only supported on macOS.',
  ),
);

export const TITLE_BAR_ACTIVE_BACKGROUND = registerColor(
  'titleBar.activeBackground',
  {
    dark: '#3C3C3C',
    light: '#DDDDDD',
    hc: '#000000',
  },
  localize(
    'titleBarActiveBackground',
    'Title bar background when the window is active. Note that this color is currently only supported on macOS.',
  ),
);

export const TITLE_BAR_INACTIVE_BACKGROUND = registerColor(
  'titleBar.inactiveBackground',
  {
    dark: transparent(TITLE_BAR_ACTIVE_BACKGROUND, 0.6),
    light: transparent(TITLE_BAR_ACTIVE_BACKGROUND, 0.6),
    hc: null,
  },
  localize(
    'titleBarInactiveBackground',
    'Title bar background when the window is inactive. Note that this color is currently only supported on macOS.',
  ),
);

export const TITLE_BAR_BORDER = registerColor(
  'titleBar.border',
  {
    dark: null,
    light: null,
    hc: contrastBorder,
  },
  localize('titleBarBorder', 'Title bar border color. Note that this color is currently only supported on macOS.'),
);
