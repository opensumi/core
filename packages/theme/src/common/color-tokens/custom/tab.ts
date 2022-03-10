import { localize } from '@opensumi/ide-core-common';

import { registerColor, transparent } from '../../color-registry';
import { foreground } from '../base';
import { hcBorderColor } from '../basic-color';

export const ktTabBarBorderDown = registerColor(
  'kt.tab.borderDown',
  { dark: '#5F656B40', light: '#5F656B40', hc: null },
  localize('Activity Bar Border bottom color.'),
);
export const ktTabActiveForeground = registerColor(
  'kt.tab.activeForeground',
  { dark: foreground, light: foreground, hc: foreground },
  localize('Tab Active foreground color.'),
);
export const ktTabInactiveForeground = registerColor(
  'kt.tab.inactiveForeground',
  { dark: transparent(foreground, 0.8), light: transparent(foreground, 0.8), hc: transparent(foreground, 0.8) },
  localize('Tab inactive foreground color.'),
);
export const ktTabActiveBorder = registerColor(
  'kt.tab.activeBorder',
  { dark: '#167cDB', light: '#167cDB', hc: hcBorderColor },
  localize('Tab Active border color.'),
);
