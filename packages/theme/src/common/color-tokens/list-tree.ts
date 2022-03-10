import { localize } from '@opensumi/ide-core-common';

import { Color } from '../../common/color';
import { registerColor } from '../color-registry';

import { activeContrastBorder, contrastBorder, focusBorder } from './base';

export const listFocusBackground = registerColor(
  'list.focusBackground',
  { dark: '#062F4A', light: '#D6EBFF', hc: null },
  localize(
    'listFocusBackground',
    'List/Tree background color for the focused item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const listFocusForeground = registerColor(
  'list.focusForeground',
  { dark: null, light: null, hc: null },
  localize(
    'listFocusForeground',
    'List/Tree foreground color for the focused item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const listActiveSelectionBackground = registerColor(
  'list.activeSelectionBackground',
  { dark: '#094771', light: '#0074E8', hc: null },
  localize(
    'listActiveSelectionBackground',
    'List/Tree background color for the selected item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const listActiveSelectionForeground = registerColor(
  'list.activeSelectionForeground',
  { dark: Color.white, light: Color.white, hc: null },
  localize(
    'listActiveSelectionForeground',
    'List/Tree foreground color for the selected item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const listInactiveSelectionBackground = registerColor(
  'list.inactiveSelectionBackground',
  { dark: '#37373D', light: '#E4E6F1', hc: null },
  localize(
    'listInactiveSelectionBackground',
    'List/Tree background color for the selected item when the list/tree is inactive. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const listInactiveSelectionForeground = registerColor(
  'list.inactiveSelectionForeground',
  { dark: null, light: null, hc: null },
  localize(
    'listInactiveSelectionForeground',
    'List/Tree foreground color for the selected item when the list/tree is inactive. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const listInactiveFocusBackground = registerColor(
  'list.inactiveFocusBackground',
  { dark: null, light: null, hc: null },
  localize(
    'listInactiveFocusBackground',
    'List/Tree background color for the focused item when the list/tree is inactive. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const listHoverBackground = registerColor(
  'list.hoverBackground',
  { dark: '#2A2D2E', light: '#F0F0F0', hc: null },
  localize('listHoverBackground', 'List/Tree background when hovering over items using the mouse.'),
);
export const listHoverForeground = registerColor(
  'list.hoverForeground',
  { dark: null, light: null, hc: null },
  localize('listHoverForeground', 'List/Tree foreground when hovering over items using the mouse.'),
);
export const listDropBackground = registerColor(
  'list.dropBackground',
  { dark: listFocusBackground, light: listFocusBackground, hc: null },
  localize('listDropBackground', 'List/Tree drag and drop background when moving items around using the mouse.'),
);
export const listHighlightForeground = registerColor(
  'list.highlightForeground',
  { dark: '#0097fb', light: '#0066BF', hc: focusBorder },
  localize('highlight', 'List/Tree foreground color of the match highlights when searching inside the list/tree.'),
);
export const listInvalidItemForeground = registerColor(
  'list.invalidItemForeground',
  { dark: '#B89500', light: '#B89500', hc: '#B89500' },
  localize(
    'invalidItemForeground',
    'List/Tree foreground color for invalid items, for example an unresolved root in explorer.',
  ),
);
export const listErrorForeground = registerColor(
  'list.errorForeground',
  { dark: '#F88070', light: '#B01011', hc: null },
  localize('listErrorForeground', 'Foreground color of list items containing errors.'),
);
export const listWarningForeground = registerColor(
  'list.warningForeground',
  { dark: '#CCA700', light: '#855F00', hc: null },
  localize('listWarningForeground', 'Foreground color of list items containing warnings.'),
);
export const listFilterWidgetBackground = registerColor(
  'listFilterWidget.background',
  { light: '#efc1ad', dark: '#653723', hc: Color.black },
  localize('listFilterWidgetBackground', 'Background color of the type filter widget in lists and trees.'),
);
export const listFilterWidgetOutline = registerColor(
  'listFilterWidget.outline',
  { dark: Color.transparent, light: Color.transparent, hc: '#f38518' },
  localize('listFilterWidgetOutline', 'Outline color of the type filter widget in lists and trees.'),
);
export const listFilterWidgetNoMatchesOutline = registerColor(
  'listFilterWidget.noMatchesOutline',
  { dark: '#BE1100', light: '#BE1100', hc: contrastBorder },
  localize(
    'listFilterWidgetNoMatchesOutline',
    'Outline color of the type filter widget in lists and trees, when there are no matches.',
  ),
);
export const treeIndentGuidesStroke = registerColor(
  'tree.indentGuidesStroke',
  { dark: '#585858', light: '#a9a9a9', hc: '#a9a9a9' },
  localize('treeIndentGuidesStroke', 'Tree stroke color for the indentation guides.'),
);
export const listFocusOutline = registerColor(
  'list.focusOutline',
  { dark: focusBorder, light: focusBorder, hc: activeContrastBorder },
  localize(
    'listFocusOutline',
    'List/Tree outline color for the focused item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
