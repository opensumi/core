import { localize } from '@opensumi/ide-core-common';

import { Color, RGBA } from '../../common/color';
import { registerColor } from '../color-registry';

/**
 * Snippet placeholder colors
 */
export const snippetTabstopHighlightBackground = registerColor(
  'editor.snippetTabstopHighlightBackground',
  {
    dark: new Color(new RGBA(124, 124, 124, 0.3)),
    light: new Color(new RGBA(10, 50, 100, 0.2)),
    hc: new Color(new RGBA(124, 124, 124, 0.3)),
  },
  localize('snippetTabstopHighlightBackground', 'Highlight background color of a snippet tabstop.'),
);
export const snippetTabstopHighlightBorder = registerColor(
  'editor.snippetTabstopHighlightBorder',
  { dark: null, light: null, hc: null },
  localize('snippetTabstopHighlightBorder', 'Highlight border color of a snippet tabstop.'),
);
export const snippetFinalTabstopHighlightBackground = registerColor(
  'editor.snippetFinalTabstopHighlightBackground',
  { dark: null, light: null, hc: null },
  localize('snippetFinalTabstopHighlightBackground', 'Highlight background color of the final tabstop of a snippet.'),
);
export const snippetFinalTabstopHighlightBorder = registerColor(
  'editor.snippetFinalTabstopHighlightBorder',
  { dark: '#525252', light: new Color(new RGBA(10, 50, 100, 0.5)), hc: '#525252' },
  localize('snippetFinalTabstopHighlightBorder', 'Highlight border color of the final stabstop of a snippet.'),
);
