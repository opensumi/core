import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../../color-registry';
import {
  listHoverBackground,
  listHoverForeground,
  listInactiveSelectionForeground,
  listInactiveSelectionBackground,
  listActiveSelectionForeground,
  listActiveSelectionBackground,
  listInvalidItemForeground,
  listFocusForeground,
  listFocusBackground,
} from '../list-tree';

export const treeHoverBackground = registerColor(
  'kt.tree.hoverBackground',
  { dark: listHoverBackground, light: listHoverBackground, hc: listHoverBackground },
  localize('treeHoverBackground', 'Tree background when hovering over items using the mouse.'),
);
export const treeHoverForeground = registerColor(
  'kt.tree.hoverForeground',
  { dark: listHoverForeground, light: listHoverForeground, hc: listHoverForeground },
  localize('treeHoverForeground', 'Tree foreground when hovering over items using the mouse.'),
);
export const treeFocusForeground = registerColor(
  'kt.tree.focusForeground',
  { dark: listFocusForeground, light: listFocusForeground, hc: listFocusForeground },
  localize(
    'treeFocusForeground',
    'Tree foreground color for the focused item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const treeFocusBackground = registerColor(
  'kt.tree.focusBackground',
  { dark: listFocusBackground, light: listFocusBackground, hc: listFocusBackground },
  localize(
    'treeFocusBackground',
    'Tree background color for the focused item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const treeInactiveSelectionForeground = registerColor(
  'kt.tree.inactiveSelectionForeground',
  {
    dark: listInactiveSelectionForeground,
    light: listInactiveSelectionForeground,
    hc: listInactiveSelectionForeground,
  },
  localize(
    'treeInactiveSelectionForeground',
    'Tree foreground color for the selected item when the list/tree is inactive. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const treeInactiveSelectionBackground = registerColor(
  'kt.tree.inactiveSelectionBackground',
  {
    dark: listInactiveSelectionBackground,
    light: listInactiveSelectionBackground,
    hc: listInactiveSelectionBackground,
  },
  localize(
    'treeInactiveSelectionBackground',
    'Tree background color for the selected item when the list/tree is inactive. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const treeActiveSelectionForeground = registerColor(
  'kt.tree.activeSelectionForeground',
  { dark: listActiveSelectionForeground, light: listActiveSelectionForeground, hc: listActiveSelectionForeground },
  localize(
    'treeActiveSelectionForeground',
    'Tree foreground color for the selected item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const treeActiveSelectionBackground = registerColor(
  'kt.tree.activeSelectionBackground',
  { dark: listActiveSelectionBackground, light: listActiveSelectionBackground, hc: listActiveSelectionBackground },
  localize(
    'treeActiveSelectionBackground',
    'Tree background color for the selected item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const treeInvalidItemForeground = registerColor(
  'kt.tree.invalidItemForeground',
  { dark: listInvalidItemForeground, light: listInvalidItemForeground, hc: listInvalidItemForeground },
  localize(
    'treeInvalidItemForeground',
    'Tree foreground color for invalid items, for example an unresolved root in explorer.',
  ),
);
