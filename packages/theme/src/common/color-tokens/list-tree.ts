import { localize } from '@opensumi/ide-core-common';

import { Color } from '../../common/color';
import { darken, lighten, registerColor, transparent } from '../utils';

import { activeContrastBorder, contrastBorder, focusBorder, foreground, widgetShadow } from './base';
import { editorFindMatchHighlight, editorFindMatchHighlightBorder, editorWidgetBackground } from './editor';

export const listFocusBackground = registerColor(
  'list.focusBackground',
  { dark: '#062F4A', light: '#D6EBFF', hcDark: null, hcLight: null },
  localize(
    'listFocusBackground',
    'List/Tree background color for the focused item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const listFocusForeground = registerColor(
  'list.focusForeground',
  { dark: null, light: null, hcDark: null, hcLight: null },
  localize(
    'listFocusForeground',
    'List/Tree foreground color for the focused item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const listFocusAndSelectionOutline = registerColor(
  'list.focusAndSelectionOutline',
  { dark: null, light: null, hcDark: null, hcLight: null },
  localize(
    'listFocusAndSelectionOutline',
    'List/Tree outline color for the focused item when the list/tree is active and selected. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const listActiveSelectionBackground = registerColor(
  'list.activeSelectionBackground',
  { dark: '#04395E', light: '#0060C0', hcDark: null, hcLight: Color.fromHex('#0F4A85').transparent(0.1) },
  localize(
    'listActiveSelectionBackground',
    'List/Tree background color for the selected item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const listActiveSelectionForeground = registerColor(
  'list.activeSelectionForeground',
  { dark: Color.white, light: Color.white, hcDark: null, hcLight: null },
  localize(
    'listActiveSelectionForeground',
    'List/Tree foreground color for the selected item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const listActiveSelectionIconForeground = registerColor(
  'list.activeSelectionIconForeground',
  { dark: null, light: null, hcDark: null, hcLight: null },
  localize(
    'listActiveSelectionIconForeground',
    'List/Tree icon foreground color for the selected item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const listInactiveSelectionBackground = registerColor(
  'list.inactiveSelectionBackground',
  { dark: '#37373D', light: '#E4E6F1', hcDark: null, hcLight: Color.fromHex('#0F4A85').transparent(0.1) },
  localize(
    'listInactiveSelectionBackground',
    'List/Tree background color for the selected item when the list/tree is inactive. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const listInactiveSelectionForeground = registerColor(
  'list.inactiveSelectionForeground',
  { dark: null, light: null, hcDark: null, hcLight: null },
  localize(
    'listInactiveSelectionForeground',
    'List/Tree foreground color for the selected item when the list/tree is inactive. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const listInactiveSelectionIconForeground = registerColor(
  'list.inactiveSelectionIconForeground',
  { dark: null, light: null, hcDark: null, hcLight: null },
  localize(
    'listInactiveSelectionIconForeground',
    'List/Tree icon foreground color for the selected item when the list/tree is inactive. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const listInactiveFocusBackground = registerColor(
  'list.inactiveFocusBackground',
  { dark: null, light: null, hcDark: null, hcLight: null },
  localize(
    'listInactiveFocusBackground',
    'List/Tree background color for the focused item when the list/tree is inactive. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const listInactiveFocusOutline = registerColor(
  'list.inactiveFocusOutline',
  { dark: null, light: null, hcDark: null, hcLight: null },
  localize(
    'listInactiveFocusOutline',
    'List/Tree outline color for the focused item when the list/tree is inactive. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const listHoverBackground = registerColor(
  'list.hoverBackground',
  { dark: '#2A2D2E', light: '#F0F0F0', hcDark: '#2A2D2E', hcLight: Color.fromHex('#0F4A85').transparent(0.1) },
  localize('listHoverBackground', 'List/Tree background when hovering over items using the mouse.'),
);
export const listHoverForeground = registerColor(
  'list.hoverForeground',
  { dark: null, light: null, hcDark: null, hcLight: null },
  localize('listHoverForeground', 'List/Tree foreground when hovering over items using the mouse.'),
);
export const listDropBackground = registerColor(
  'list.dropBackground',
  { dark: '#062F4A', light: '#D6EBFF', hcDark: null, hcLight: null },
  localize('listDropBackground', 'List/Tree drag and drop background when moving items around using the mouse.'),
);
export const listHighlightForeground = registerColor(
  'list.highlightForeground',
  { dark: '#2AAAFF', light: '#0066BF', hcDark: focusBorder, hcLight: focusBorder },
  localize('highlight', 'List/Tree foreground color of the match highlights when searching inside the list/tree.'),
);
export const listInvalidItemForeground = registerColor(
  'list.invalidItemForeground',
  { dark: '#B89500', light: '#B89500', hcDark: '#B89500', hcLight: '#B5200D' },
  localize(
    'invalidItemForeground',
    'List/Tree foreground color for invalid items, for example an unresolved root in explorer.',
  ),
);
export const listErrorForeground = registerColor(
  'list.errorForeground',
  { dark: '#F88070', light: '#B01011', hcDark: null, hcLight: null },
  localize('listErrorForeground', 'Foreground color of list items containing errors.'),
);
export const listWarningForeground = registerColor(
  'list.warningForeground',
  { dark: '#CCA700', light: '#855F00', hcDark: null, hcLight: null },
  localize('listWarningForeground', 'Foreground color of list items containing warnings.'),
);
export const listFilterWidgetBackground = registerColor(
  'listFilterWidget.background',
  {
    light: darken(editorWidgetBackground, 0),
    dark: lighten(editorWidgetBackground, 0),
    hcDark: editorWidgetBackground,
    hcLight: editorWidgetBackground,
  },
  localize('listFilterWidgetBackground', 'Background color of the type filter widget in lists and trees.'),
);
export const listFilterWidgetOutline = registerColor(
  'listFilterWidget.outline',
  { dark: Color.transparent, light: Color.transparent, hcDark: '#f38518', hcLight: '#007ACC' },
  localize('listFilterWidgetOutline', 'Outline color of the type filter widget in lists and trees.'),
);
export const listFilterWidgetNoMatchesOutline = registerColor(
  'listFilterWidget.noMatchesOutline',
  { dark: '#BE1100', light: '#BE1100', hcDark: contrastBorder, hcLight: contrastBorder },
  localize(
    'listFilterWidgetNoMatchesOutline',
    'Outline color of the type filter widget in lists and trees, when there are no matches.',
  ),
);
export const listFilterWidgetShadow = registerColor(
  'listFilterWidget.shadow',
  { dark: widgetShadow, light: widgetShadow, hcDark: widgetShadow, hcLight: widgetShadow },
  localize('listFilterWidgetShadow', 'Shadown color of the type filter widget in lists and trees.'),
);
export const listFilterMatchHighlight = registerColor(
  'list.filterMatchBackground',
  { dark: editorFindMatchHighlight, light: editorFindMatchHighlight, hcDark: null, hcLight: null },
  localize('listFilterMatchHighlight', 'Background color of the filtered match.'),
);
export const listFilterMatchHighlightBorder = registerColor(
  'list.filterMatchBorder',
  {
    dark: editorFindMatchHighlightBorder,
    light: editorFindMatchHighlightBorder,
    hcDark: contrastBorder,
    hcLight: activeContrastBorder,
  },
  localize('listFilterMatchHighlightBorder', 'Border color of the filtered match.'),
);
export const treeIndentGuidesStroke = registerColor(
  'tree.indentGuidesStroke',
  { dark: '#585858', light: '#a9a9a9', hcDark: '#a9a9a9', hcLight: '#a5a5a5' },
  localize('treeIndentGuidesStroke', 'Tree stroke color for the indentation guides.'),
);
export const listFocusOutline = registerColor(
  'list.focusOutline',
  { dark: focusBorder, light: focusBorder, hcDark: activeContrastBorder, hcLight: activeContrastBorder },
  localize(
    'listFocusOutline',
    'List/Tree outline color for the focused item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.',
  ),
);
export const tableColumnsBorder = registerColor(
  'tree.tableColumnsBorder',
  { dark: '#CCCCCC20', light: '#61616120', hcDark: null, hcLight: null },
  localize('tableColumnsBorder', 'Table border color between columns.'),
);
export const tableOddRowsBackgroundColor = registerColor(
  'tree.tableOddRowsBackground',
  { dark: transparent(foreground, 0.04), light: transparent(foreground, 0.04), hcDark: null, hcLight: null },
  localize('tableOddRowsBackgroundColor', 'Background color for odd table rows.'),
);
export const listDeemphasizedForeground = registerColor(
  'list.deemphasizedForeground',
  { dark: '#8C8C8C', light: '#8E8E90', hcDark: '#A7A8A9', hcLight: '#666666' },
  localize('listDeemphasizedForeground', 'List/Tree foreground color for items that are deemphasized. '),
);
