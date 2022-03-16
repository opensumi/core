import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../../color-registry';
import { contrastBorder } from '../base';

export const ActivityBarBadgeBorder = registerColor(
  'kt.activityBarBadge.border',
  {
    dark: null,
    light: null,
    hc: contrastBorder,
  },
  localize(
    'activityBarBadgeBorder',
    'Activity notification badge border color. The activity bar is showing on the far left or right and allows to switch between views of the side bar.',
  ),
);

export const BadgeBorder = registerColor(
  'kt.badge.border',
  {
    dark: null,
    light: null,
    hc: contrastBorder,
  },
  localize('badgeBorder', 'Badge border color. Badges are small information labels, e.g. for search results count.'),
);
