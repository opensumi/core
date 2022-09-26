import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../../utils';
import { ACTIVITY_BAR_BACKGROUND } from '../activity-bar';

/* --- activity bar --- */
export const ktActivityBarDropUpBackground = registerColor(
  'kt.activityBar.dropUpBackground',
  {
    dark: ACTIVITY_BAR_BACKGROUND,
    light: ACTIVITY_BAR_BACKGROUND,
    hcDark: ACTIVITY_BAR_BACKGROUND,
    hcLight: ACTIVITY_BAR_BACKGROUND,
  },
  localize('activityBar.dropUpBackground', 'dragging item background color'),
);
