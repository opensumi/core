import { localize } from '@opensumi/ide-core-common';

import { darken, lighten, registerColor } from '../utils';

import { activeContrastBorder } from './base';
/**
 * Toolbar colors
 */
export const toolbarHoverBackground = registerColor(
  'toolbar.hoverBackground',
  { dark: '#5a5d5e50', light: '#b8b8b850', hcDark: null, hcLight: null },
  localize('toolbarHoverBackground', 'Toolbar background when hovering over actions using the mouse'),
);
export const toolbarHoverOutline = registerColor(
  'toolbar.hoverOutline',
  { dark: null, light: null, hcDark: activeContrastBorder, hcLight: activeContrastBorder },
  localize('toolbarHoverOutline', 'Toolbar outline when hovering over actions using the mouse'),
);
export const toolbarActiveBackground = registerColor(
  'toolbar.activeBackground',
  {
    dark: lighten(toolbarHoverBackground, 0.1),
    light: darken(toolbarHoverBackground, 0.1),
    hcDark: null,
    hcLight: null,
  },
  localize('toolbarActiveBackground', 'Toolbar background when holding the mouse over actions'),
);
