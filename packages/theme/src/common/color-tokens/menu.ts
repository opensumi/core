import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../color-registry';

import { contrastBorder, activeContrastBorder, foreground } from './base';
import { dropdownBackground, dropdownForeground } from './dropdown';
import { listActiveSelectionForeground, listActiveSelectionBackground } from './list-tree';

export const menuBorder = registerColor(
  'menu.border',
  { dark: null, light: null, hc: contrastBorder },
  localize('menuBorder', 'Border color of menus.'),
);
export const menuForeground = registerColor(
  'menu.foreground',
  { dark: dropdownForeground, light: foreground, hc: dropdownForeground },
  localize('menuForeground', 'Foreground color of menu items.'),
);
export const menuBackground = registerColor(
  'menu.background',
  { dark: dropdownBackground, light: dropdownBackground, hc: dropdownBackground },
  localize('menuBackground', 'Background color of menu items.'),
);
export const menuSelectionForeground = registerColor(
  'menu.selectionForeground',
  { dark: listActiveSelectionForeground, light: listActiveSelectionForeground, hc: listActiveSelectionForeground },
  localize('menuSelectionForeground', 'Foreground color of the selected menu item in menus.'),
);
export const menuSelectionBackground = registerColor(
  'menu.selectionBackground',
  { dark: listActiveSelectionBackground, light: listActiveSelectionBackground, hc: listActiveSelectionBackground },
  localize('menuSelectionBackground', 'Background color of the selected menu item in menus.'),
);
export const menuSelectionBorder = registerColor(
  'menu.selectionBorder',
  { dark: null, light: null, hc: activeContrastBorder },
  localize('menuSelectionBorder', 'Border color of the selected menu item in menus.'),
);
export const menuSeparatorBackground = registerColor(
  'menu.separatorBackground',
  { dark: '#BBBBBB6B', light: '#8888886B', hc: contrastBorder },
  localize('menuSeparatorBackground', 'Color of a separator menu item in menus.'),
);
