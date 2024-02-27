import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../utils';

import { activeContrastBorder, contrastBorder, foreground } from './base';
import { selectBackground, selectForeground } from './dropdown';
import { listActiveSelectionBackground, listActiveSelectionForeground } from './list-tree';

export const menuBorder = registerColor(
  'menu.border',
  { dark: null, light: null, hcDark: contrastBorder, hcLight: contrastBorder },
  localize('menuBorder', 'Border color of menus.'),
);
export const menuForeground = registerColor(
  'menu.foreground',
  { dark: selectForeground, light: foreground, hcDark: selectForeground, hcLight: selectForeground },
  localize('menuForeground', 'Foreground color of menu items.'),
);
export const menuBackground = registerColor(
  'menu.background',
  { dark: selectBackground, light: selectBackground, hcDark: selectBackground, hcLight: selectBackground },
  localize('menuBackground', 'Background color of menu items.'),
);
export const menuSelectionForeground = registerColor(
  'menu.selectionForeground',
  {
    dark: listActiveSelectionForeground,
    light: listActiveSelectionForeground,
    hcDark: listActiveSelectionForeground,
    hcLight: listActiveSelectionForeground,
  },
  localize('menuSelectionForeground', 'Foreground color of the selected menu item in menus.'),
);
export const menuSelectionBackground = registerColor(
  'menu.selectionBackground',
  {
    dark: listActiveSelectionBackground,
    light: listActiveSelectionBackground,
    hcDark: listActiveSelectionBackground,
    hcLight: listActiveSelectionBackground,
  },
  localize('menuSelectionBackground', 'Background color of the selected menu item in menus.'),
);
export const menuSelectionBorder = registerColor(
  'menu.selectionBorder',
  { dark: null, light: null, hcDark: activeContrastBorder, hcLight: activeContrastBorder },
  localize('menuSelectionBorder', 'Border color of the selected menu item in menus.'),
);
export const menuSeparatorBackground = registerColor(
  'menu.separatorBackground',
  { dark: '#606060', light: '#D4D4D4', hcDark: contrastBorder, hcLight: contrastBorder },
  localize('menuSeparatorBackground', 'Color of a separator menu item in menus.'),
);
