import { localize } from '@opensumi/ide-core-common';

import { Color } from '../../common/color';
import { registerColor, transparent } from '../color-registry';

import { contrastBorder } from './base';
import { hcActiveBorderColor } from './basic-color';
import { SIDE_BAR_BORDER } from './sidebar';

// < --- Activity Bar --- >

export const ACTIVITY_BAR_BACKGROUND = registerColor(
  'activityBar.background',
  {
    dark: '#333333',
    light: '#2C2C2C',
    hc: '#000000',
  },
  localize(
    'activityBarBackground',
    'Activity bar background color. The activity bar is showing on the far left or right and allows to switch between views of the side bar.',
  ),
);

export const ACTIVITY_BAR_FOREGROUND = registerColor(
  'activityBar.foreground',
  {
    dark: Color.white,
    light: Color.white,
    hc: Color.white,
  },
  localize(
    'activityBarForeground',
    'Activity bar item foreground color when it is active. The activity bar is showing on the far left or right and allows to switch between views of the side bar.',
  ),
);

export const ACTIVITY_BAR_INACTIVE_FOREGROUND = registerColor(
  'activityBar.inactiveForeground',
  {
    dark: transparent(ACTIVITY_BAR_FOREGROUND, 0.6),
    light: transparent(ACTIVITY_BAR_FOREGROUND, 0.6),
    hc: Color.white,
  },
  localize(
    'activityBarInActiveForeground',
    'Activity bar item foreground color when it is inactive. The activity bar is showing on the far left or right and allows to switch between views of the side bar.',
  ),
);

export const ACTIVITY_BAR_BORDER = registerColor(
  'activityBar.border',
  {
    dark: SIDE_BAR_BORDER,
    light: SIDE_BAR_BORDER,
    hc: SIDE_BAR_BORDER,
  },
  localize(
    'activityBarBorder',
    'Activity bar border color separating to the side bar. The activity bar is showing on the far left or right and allows to switch between views of the side bar.',
  ),
);

export const ACTIVITY_BAR_DRAG_AND_DROP_BACKGROUND = registerColor(
  'activityBar.dropBackground',
  {
    dark: Color.white.transparent(0.12),
    light: Color.white.transparent(0.12),
    hc: Color.white.transparent(0.12),
  },
  localize(
    'activityBarDragAndDropBackground',
    'Drag and drop feedback color for the activity bar items. The color should have transparency so that the activity bar entries can still shine through. The activity bar is showing on the far left or right and allows to switch between views of the side bar.',
  ),
);

export const ACTIVITY_BAR_BADGE_BACKGROUND = registerColor(
  'activityBarBadge.background',
  {
    dark: '#007ACC',
    light: '#007ACC',
    hc: '#000000',
  },
  localize(
    'activityBarBadgeBackground',
    'Activity notification badge background color. The activity bar is showing on the far left or right and allows to switch between views of the side bar.',
  ),
);

export const ACTIVITY_BAR_BADGE_FOREGROUND = registerColor(
  'activityBarBadge.foreground',
  {
    dark: Color.white,
    light: Color.white,
    hc: Color.white,
  },
  localize(
    'activityBarBadgeForeground',
    'Activity notification badge foreground color. The activity bar is showing on the far left or right and allows to switch between views of the side bar.',
  ),
);

export const ACTIVITY_BAR_ACTIVE_BORDER = registerColor(
  'activityBar.activeBorder',
  {
    dark: ACTIVITY_BAR_FOREGROUND,
    light: ACTIVITY_BAR_FOREGROUND,
    hc: hcActiveBorderColor,
  },
  localize(
    'activityBarActiveBorder',
    'Activity bar border color for the active item. The activity bar is showing on the far left or right and allows to switch between views of the side bar.',
  ),
);
