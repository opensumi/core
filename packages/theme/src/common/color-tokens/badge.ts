import { localize } from '@opensumi/ide-core-common';

import { Color } from '../../common/color';
import { registerColor } from '../color-registry';

export const badgeBackground = registerColor(
  'badge.background',
  { dark: '#4D4D4D', light: '#C4C4C4', hc: Color.black },
  localize(
    'badgeBackground',
    'Badge background color. Badges are small information labels, e.g. for search results count.',
  ),
);
export const badgeForeground = registerColor(
  'badge.foreground',
  { dark: Color.white, light: '#333', hc: Color.white },
  localize(
    'badgeForeground',
    'Badge foreground color. Badges are small information labels, e.g. for search results count.',
  ),
);
