import { localize } from '@opensumi/ide-core-common';

import { Color } from '../../common/color';
import { registerColor } from '../utils';

export const pickerGroupForeground = registerColor(
  'pickerGroup.foreground',
  { dark: '#3794FF', light: '#0066BF', hcDark: Color.white, hcLight: '#0F4A85' },
  localize('pickerGroupForeground', 'Quick picker color for grouping labels.'),
);
export const pickerGroupBorder = registerColor(
  'pickerGroup.border',
  { dark: '#3F3F46', light: '#CCCEDB', hcDark: Color.white, hcLight: '#0F4A85' },
  localize('pickerGroupBorder', 'Quick picker color for grouping borders.'),
);
