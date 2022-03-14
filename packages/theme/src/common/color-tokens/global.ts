import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../color-registry';

// 全局聚焦状态边框颜色 包括 input
export const focusBorder = registerColor(
  'focus.border',
  { dark: '#5F656B', light: '#5F656B', hc: null },
  localize('focusBorder', 'Focus Border color.'),
);
