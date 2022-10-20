import { localize } from '@opensumi/ide-core-common';

import { registerColor, transparent } from '../../utils';
import { foreground } from '../base';

export const ktIconForeground = registerColor(
  'kt.icon.foreground',
  { dark: foreground, light: foreground, hcDark: foreground, hcLight: foreground },
  localize('ktIconForeground', 'Icon Foreground color.'),
);
export const ktIconHoverForeground = registerColor(
  'kt.icon.hoverForeground',
  { dark: foreground, light: foreground, hcDark: foreground, hcLight: foreground },
  localize('ktIconHoverForeground', 'Icon Hover Foreground color.'),
);
export const ktIconHoverBackground = registerColor(
  'kt.icon.hoverBackground',
  { dark: '#5a5d5e4f', light: '#b8b8b84f', hcDark: null, hcLight: null },
  localize('Icon Hover Background color.'),
);
export const ktIconClickHoverForeground = registerColor(
  'kt.icon.clickForeground',
  { dark: foreground, light: foreground, hcDark: foreground, hcLight: foreground },
  localize('Icon Click Foreground color.'),
);
export const ktIconDisableForeground = registerColor(
  'kt.icon.disableForeground',
  { dark: transparent(ktIconForeground, 0.5), light: transparent(ktIconForeground, 0.5), hcDark: null, hcLight: null },
  localize('ktIconDisableForeground', 'Icon Disabled Foreground color.'),
);
