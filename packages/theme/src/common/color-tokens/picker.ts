import { localize } from '@opensumi/ide-core-common';

import { Color } from '../../common/color';
import { registerColor } from '../color-registry';

export const pickerGroupForeground = registerColor(
  'pickerGroup.foreground',
  { dark: '#3794FF', light: '#0066BF', hc: Color.white },
  localize('pickerGroupForeground', 'Quick picker color for grouping labels.'),
);
export const pickerGroupBorder = registerColor(
  'pickerGroup.border',
  { dark: '#3F3F46', light: '#CCCEDB', hc: Color.white },
  localize('pickerGroupBorder', 'Quick picker color for grouping borders.'),
);
