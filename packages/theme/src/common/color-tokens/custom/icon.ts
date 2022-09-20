import { localize } from '@opensumi/ide-core-common';

import { registerColor, transparent } from '../../utils';
import { buttonBackground, buttonForeground, buttonHoverBackground } from '../button';

export const ktIconForeground = registerColor(
  'kt.icon.foreground',
  { dark: buttonForeground, light: buttonForeground, hc: buttonForeground },
  localize('ktIconForeground', 'Icon Foreground color.'),
);
export const ktIconHoverForeground = registerColor(
  'kt.icon.hoverForeground',
  { dark: buttonBackground, light: buttonBackground, hc: buttonBackground },
  localize('ktIconHoverForeground', 'Icon Hover Foreground color.'),
);
export const ktIconHoverBackground = registerColor(
  'kt.icon.hoverBackground',
  { dark: buttonHoverBackground, light: buttonHoverBackground, hc: buttonHoverBackground },
  localize('Icon Hover Background color.'),
);
export const ktIconClickHoverForeground = registerColor(
  'kt.icon.clickForeground',
  { dark: buttonHoverBackground, light: buttonHoverBackground, hc: buttonHoverBackground },
  localize('Icon Click Foreground color.'),
);
export const ktIconDisableForeground = registerColor(
  'kt.icon.disableForeground',
  { dark: transparent(ktIconForeground, 0.5), light: transparent(ktIconForeground, 0.5), hc: null },
  localize('ktIconDisableForeground', 'Icon Disabled Foreground color.'),
);
