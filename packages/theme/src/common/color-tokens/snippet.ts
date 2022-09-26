import { localize } from '@opensumi/ide-core-common';

import { Color, RGBA } from '../../common/color';
import { registerColor } from '../utils';

/**
 * Snippet placeholder colors
 */
export const snippetTabstopHighlightBackground = registerColor(
  'editor.snippetTabstopHighlightBackground',
  {
    dark: new Color(new RGBA(124, 124, 124, 0.3)),
    light: new Color(new RGBA(10, 50, 100, 0.2)),
    hcDark: new Color(new RGBA(124, 124, 124, 0.3)),
    hcLight: new Color(new RGBA(10, 50, 100, 0.2)),
  },
  localize('snippetTabstopHighlightBackground', 'Highlight background color of a snippet tabstop.'),
);
export const snippetTabstopHighlightBorder = registerColor(
  'editor.snippetTabstopHighlightBorder',
  { dark: null, light: null, hcDark: null, hcLight: null },
  localize('snippetTabstopHighlightBorder', 'Highlight border color of a snippet tabstop.'),
);
export const snippetFinalTabstopHighlightBackground = registerColor(
  'editor.snippetFinalTabstopHighlightBackground',
  { dark: null, light: null, hcDark: null, hcLight: null },
  localize('snippetFinalTabstopHighlightBackground', 'Highlight background color of the final tabstop of a snippet.'),
);
export const snippetFinalTabstopHighlightBorder = registerColor(
  'editor.snippetFinalTabstopHighlightBorder',
  { dark: '#525252', light: new Color(new RGBA(10, 50, 100, 0.5)), hcDark: '#525252', hcLight: '#292929' },
  localize('snippetFinalTabstopHighlightBorder', 'Highlight border color of the final tabstop of a snippet.'),
);
