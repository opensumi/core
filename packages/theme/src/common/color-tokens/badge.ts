import { localize } from '@opensumi/ide-core-common';

import { Color } from '../../common/color';
import { registerColor } from '../utils';

export const badgeBackground = registerColor(
  'badge.background',
  {
    dark: '#4D4D4D',
    light: '#C4C4C4',
    hcDark: Color.black,
    hcLight: '#0F4A85',
  },
  localize(
    'badgeBackground',
    'Badge background color. Badges are small information labels, e.g. for search results count.',
  ),
);
export const badgeForeground = registerColor(
  'badge.foreground',
  {
    dark: Color.white,
    light: '#333',
    hcDark: Color.white,
    hcLight: Color.white,
  },
  localize(
    'badgeForeground',
    'Badge foreground color. Badges are small information labels, e.g. for search results count.',
  ),
);
