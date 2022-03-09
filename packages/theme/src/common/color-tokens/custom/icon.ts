import { localize } from '@opensumi/ide-core-common';

import { registerColor, actionbarForeground } from '../../color-registry';

export const ktIconForeground = registerColor(
  'kt.icon.foreground',
  { dark: '#D7DBDE', light: '#D7DBDE', hc: null },
  localize('ktIconForeground', 'Icon Foreground color.'),
);
export const ktIconHoverForeground = registerColor(
  'kt.icon.hoverForeground',
  { dark: '#FFFFFF', light: actionbarForeground, hc: null },
  localize('ktIconHoverForeground', 'Icon Hover Foreground color.'),
);
export const ktIconHoverBackground = registerColor(
  'kt.icon.hoverBackground',
  { dark: '#1B2F44', light: '#1B2F44', hc: null },
  localize('Icon Hover Background color.'),
);
export const ktIconClickHoverForeground = registerColor(
  'kt.icon.clickForeground',
  { dark: '#FFFFFF', light: '#FFFFFF', hc: null },
  localize('Icon Click Foreground color.'),
);
export const ktIconDisableForeground = registerColor(
  'kt.icon.disableForeground',
  { dark: '#5F656B', light: '#5F656B', hc: null },
  localize('ktIconDisableForeground', 'Icon Disabled Foreground color.'),
);
