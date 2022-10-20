import { localize } from '@opensumi/ide-core-common';

import { transparent, registerColor } from '../../utils';
import { foreground } from '../base';
import { hcBorderColor } from '../basic-color';

export const ktTabBarBorderDown = registerColor(
  'kt.tab.borderDown',
  { dark: '#5F656B40', light: '#5F656B40', hcDark: null, hcLight: null },
  localize('Activity Bar Border bottom color.'),
);
export const ktTabActiveForeground = registerColor(
  'kt.tab.activeForeground',
  { dark: foreground, light: foreground, hcDark: foreground, hcLight: foreground },
  localize('Tab Active foreground color.'),
);
export const ktTabInactiveForeground = registerColor(
  'kt.tab.inactiveForeground',
  {
    dark: transparent(foreground, 0.8),
    light: transparent(foreground, 0.8),
    hcDark: transparent(foreground, 0.8),
    hcLight: transparent(foreground, 0.8),
  },
  localize('Tab inactive foreground color.'),
);
export const ktTabActiveBorder = registerColor(
  'kt.tab.activeBorder',
  { dark: '#167cDB', light: '#167cDB', hcDark: hcBorderColor, hcLight: hcBorderColor },
  localize('Tab Active border color.'),
);
