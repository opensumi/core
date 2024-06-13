import { localize } from '@opensumi/ide-core-common';

import { Color, RGBA } from '../../common/color';
import { darken, lessProminent, lighten, registerColor, transparent } from '../utils';

import { badgeBackground, badgeForeground } from './badge';
import { activeContrastBorder, contrastBorder, focusBorder, foreground } from './base';

// TODO COLOR 此处vscode内的editor error warning info颜色都有做修改
export const editorErrorBackground = registerColor(
  'editorError.background',
  { dark: null, light: null, hcDark: null, hcLight: null },
  localize(
    'editorError.background',
    'Background color of error text in the editor. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);

export const editorErrorForeground = registerColor(
  'editorError.foreground',
  { dark: '#F14C4C', light: '#E51400', hcDark: '#F48771', hcLight: '#B5200D' },
  localize('editorError.foreground', 'Foreground color of error squigglies in the editor.'),
);
export const editorErrorBorder = registerColor(
  'editorError.border',
  {
    dark: null,
    light: null,
    hcDark: Color.fromHex('#E47777').transparent(0.8),
    hcLight: '#B5200D',
  },
  localize('errorBorder', 'Border color of error boxes in the editor.'),
);
export const editorWarningBackground = registerColor(
  'editorWarning.background',
  { dark: null, light: null, hcDark: null, hcLight: null },
  localize(
    'editorWarning.background',
    'Background color of warning text in the editor. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);

export const editorWarningForeground = registerColor(
  'editorWarning.foreground',
  { dark: '#CCA700', light: '#BF8803', hcDark: '#FFD37', hcLight: '#895503' },
  localize('editorWarning.foreground', 'Foreground color of warning squigglies in the editor.'),
);
export const editorWarningBorder = registerColor(
  'editorWarning.border',
  {
    dark: null,
    light: null,
    hcDark: Color.fromHex('#FFCC00').transparent(0.8),
    hcLight: '#',
  },
  localize('warningBorder', 'Border color of warning boxes in the editor.'),
);

export const editorInfoForeground = registerColor(
  'editorInfo.foreground',
  { dark: '#3794FF', light: '#1a85ff', hcDark: '#3794FF', hcLight: '#1a85ff' },
  localize('editorInfo.foreground', 'Foreground color of info squigglies in the editor.'),
);
export const editorInfoBorder = registerColor(
  'editorInfo.border',
  {
    dark: null,
    light: null,
    hcDark: Color.fromHex('#3794FF').transparent(0.8),
    hcLight: '#292929',
  },
  localize('infoBorder', 'Border color of info boxes in the editor.'),
);
export const editorInfoBackground = registerColor(
  'editorInfo.background',
  { dark: null, light: null, hcDark: null, hcLight: null },
  localize(
    'editorInfo.background',
    'Background color of info text in the editor. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);

export const editorHintForeground = registerColor(
  'editorHint.foreground',
  { dark: Color.fromHex('#eeeeee').transparent(0.7), light: '#6c6c6c', hcDark: null, hcLight: null },
  localize('editorHint.foreground', 'Foreground color of hint squigglies in the editor.'),
);
export const editorHintBorder = registerColor(
  'editorHint.border',
  { dark: null, light: null, hcDark: Color.fromHex('#eeeeee').transparent(0.8), hcLight: '#292929' },
  localize('hintBorder', 'Border color of hint boxes in the editor.'),
);

export const editorBackground = registerColor(
  'editor.background',
  { light: '#ffffff', dark: '#1E1E1E', hcDark: Color.black, hcLight: Color.white },
  localize('editorBackground', 'Editor background color.'),
);

/**
 * Editor foreground color.
 */
export const editorForeground = registerColor(
  'editor.foreground',
  { light: '#333333', dark: '#BBBBBB', hcDark: Color.white, hcLight: foreground },
  localize('editorForeground', 'Editor default foreground color.'),
);

/**
 * Editor widgets
 */
export const editorWidgetForeground = registerColor(
  'editorWidget.foreground',
  { dark: foreground, light: foreground, hcDark: foreground, hcLight: foreground },
  localize('editorWidgetForeground', 'Foreground color of editor widgets, such as find/replace.'),
);
export const editorWidgetBackground = registerColor(
  'editorWidget.background',
  { dark: '#252526', light: '#F3F3F3', hcDark: '#0C141F', hcLight: Color.white },
  localize('editorWidgetBackground', 'Background color of editor widgets, such as find/replace.'),
);
export const editorWidgetBorder = registerColor(
  'editorWidget.border',
  { dark: '#454545', light: '#C8C8C8', hcDark: contrastBorder, hcLight: contrastBorder },
  localize(
    'editorWidgetBorder',
    'Border color of editor widgets. The color is only used if the widget chooses to have a border and if the color is not overridden by a widget.',
  ),
);

export const editorWidgetResizeBorder = registerColor(
  'editorWidget.resizeBorder',
  { light: null, dark: null, hcDark: null, hcLight: null },
  localize(
    'editorWidgetResizeBorder',
    'Border color of the resize bar of editor widgets. The color is only used if the widget chooses to have a resize border and if the color is not overridden by a widget.',
  ),
);

/**
 * Editor selection colors.
 */
export const editorSelectionBackground = registerColor(
  'editor.selectionBackground',
  { light: '#ADD6FF', dark: '#264F78', hcDark: '#f3f518', hcLight: '#0F4A85' },
  localize('editorSelectionBackground', 'Color of the editor selection.'),
);
export const editorSelectionForeground = registerColor(
  'editor.selectionForeground',
  { light: null, dark: null, hcDark: '#000000', hcLight: Color.white },
  localize('editorSelectionForeground', 'Color of the selected text for high contrast.'),
);
export const editorInactiveSelection = registerColor(
  'editor.inactiveSelectionBackground',
  {
    light: transparent(editorSelectionBackground, 0.5),
    dark: transparent(editorSelectionBackground, 0.5),
    hcDark: transparent(editorSelectionBackground, 0.7),
    hcLight: transparent(editorSelectionBackground, 0.5),
  },
  localize(
    'editorInactiveSelection',
    'Color of the selection in an inactive editor. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
export const editorSelectionHighlight = registerColor(
  'editor.selectionHighlightBackground',
  {
    light: lessProminent(editorSelectionBackground, editorBackground, 0.3, 0.6),
    dark: lessProminent(editorSelectionBackground, editorBackground, 0.3, 0.6),
    hcDark: null,
    hcLight: null,
  },
  localize(
    'editorSelectionHighlight',
    'Color for regions with the same content as the selection. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
export const editorSelectionHighlightBorder = registerColor(
  'editor.selectionHighlightBorder',
  { light: null, dark: null, hcDark: activeContrastBorder, hcLight: activeContrastBorder },
  localize('editorSelectionHighlightBorder', 'Border color for regions with the same content as the selection.'),
);

/**
 * Editor find match colors.
 */
export const editorFindMatch = registerColor(
  'editor.findMatchBackground',
  { light: '#A8AC94', dark: '#515C6A', hcDark: null, hcLight: null },
  localize('editorFindMatch', 'Color of the current search match.'),
);
export const editorFindMatchHighlight = registerColor(
  'editor.findMatchHighlightBackground',
  { light: '#EA5C0055', dark: '#EA5C0055', hcDark: '#EA5C0055', hcLight: '#EA5C0055' },
  localize(
    'findMatchHighlight',
    'Color of the other search matches. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
export const editorFindRangeHighlight = registerColor(
  'editor.findRangeHighlightBackground',
  { dark: '#3a3d4166', light: '#b4b4b44d', hcDark: null, hcLight: null },
  localize(
    'findRangeHighlight',
    'Color of the range limiting the search. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
export const editorFindMatchBorder = registerColor(
  'editor.findMatchBorder',
  { light: null, dark: null, hcDark: activeContrastBorder, hcLight: activeContrastBorder },
  localize('editorFindMatchBorder', 'Border color of the current search match.'),
);
export const editorFindMatchHighlightBorder = registerColor(
  'editor.findMatchHighlightBorder',
  { light: null, dark: null, hcDark: activeContrastBorder, hcLight: activeContrastBorder },
  localize('findMatchHighlightBorder', 'Border color of the other search matches.'),
);
export const editorFindRangeHighlightBorder = registerColor(
  'editor.findRangeHighlightBorder',
  {
    dark: null,
    light: null,
    hcDark: transparent(activeContrastBorder, 0.4),
    hcLight: transparent(activeContrastBorder, 0.4),
  },
  localize(
    'findRangeHighlightBorder',
    'Border color of the range limiting the search. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
/**
 * Search Editor query match colors.
 *
 * Distinct from normal editor find match to allow for better differentiation
 */
export const searchEditorFindMatch = registerColor(
  'searchEditor.findMatchBackground',
  {
    light: transparent(editorFindMatchHighlight, 0.66),
    dark: transparent(editorFindMatchHighlight, 0.66),
    hcDark: editorFindMatchHighlight,
    hcLight: editorFindMatchHighlight,
  },
  localize('searchEditor.queryMatch', 'Color of the Search Editor query matches.'),
);
export const searchEditorFindMatchBorder = registerColor(
  'searchEditor.findMatchBorder',
  {
    light: transparent(editorFindMatchHighlightBorder, 0.66),
    dark: transparent(editorFindMatchHighlightBorder, 0.66),
    hcDark: editorFindMatchHighlightBorder,
    hcLight: editorFindMatchHighlightBorder,
  },
  localize('searchEditor.editorFindMatchBorder', 'Border color of the Search Editor query matches.'),
);

/**
 * Editor hover
 */
export const editorHoverHighlight = registerColor(
  'editor.hoverHighlightBackground',
  { light: '#ADD6FF26', dark: '#264f7840', hcDark: '#ADD6FF26', hcLight: null },
  localize(
    'hoverHighlight',
    'Highlight below the word for which a hover is shown. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
export const editorHoverBackground = registerColor(
  'editorHoverWidget.background',
  {
    light: editorWidgetBackground,
    dark: editorWidgetBackground,
    hcDark: editorWidgetBackground,
    hcLight: editorWidgetBackground,
  },
  localize('hoverBackground', 'Background color of the editor hover.'),
);
export const editorHoverForeground = registerColor(
  'editorHoverWidget.foreground',
  {
    light: editorWidgetForeground,
    dark: editorWidgetForeground,
    hcDark: editorWidgetForeground,
    hcLight: editorWidgetForeground,
  },
  localize('hoverForeground', 'Foreground color of the editor hover.'),
);

export const editorHoverBorder = registerColor(
  'editorHoverWidget.border',
  { light: editorWidgetBorder, dark: editorWidgetBorder, hcDark: editorWidgetBorder, hcLight: editorWidgetBorder },
  localize('hoverBorder', 'Border color of the editor hover.'),
);
export const editorHoverStatusBarBackground = registerColor(
  'editorHoverWidget.statusBarBackground',
  {
    dark: lighten(editorHoverBackground, 0.2),
    light: darken(editorHoverBackground, 0.05),
    hcDark: editorWidgetBackground,
    hcLight: editorWidgetBackground,
  },
  localize('statusBarBackground', 'Background color of the editor hover status bar.'),
);

/**
 * Editor link colors
 */
export const editorActiveLinkForeground = registerColor(
  'editorLink.activeForeground',
  { dark: '#4E94CE', light: Color.blue, hcDark: Color.cyan, hcLight: '#292929' },
  localize('activeLinkForeground', 'Color of active links.'),
);

/**
 * Diff Editor Colors
 */
export const defaultInsertColor = new Color(new RGBA(155, 185, 85, 0.2));
export const defaultRemoveColor = new Color(new RGBA(255, 0, 0, 0.2));
export const diffInserted = registerColor(
  'diffEditor.insertedTextBackground',
  { dark: defaultInsertColor, light: defaultInsertColor, hcDark: null, hcLight: null },
  localize(
    'diffEditorInserted',
    'Background color for text that got inserted. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
export const diffRemoved = registerColor(
  'diffEditor.removedTextBackground',
  { dark: '#ff000066', light: '#ff00004d', hcDark: null, hcLight: null },
  localize(
    'diffEditorRemoved',
    'Background color for text that got removed. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);

export const diffInsertedLine = registerColor(
  'diffEditor.insertedLineBackground',
  { dark: defaultInsertColor, light: defaultInsertColor, hcDark: null, hcLight: null },
  localize(
    'diffEditorInsertedLines',
    'Background color for lines that got inserted. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
export const diffRemovedLine = registerColor(
  'diffEditor.removedLineBackground',
  { dark: defaultRemoveColor, light: defaultRemoveColor, hcDark: null, hcLight: null },
  localize(
    'diffEditorRemovedLines',
    'Background color for lines that got removed. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);

export const diffInsertedLineGutter = registerColor(
  'diffEditorGutter.insertedLineBackground',
  { dark: null, light: null, hcDark: null, hcLight: null },
  localize('diffEditorInsertedLineGutter', 'Background color for the margin where lines got inserted.'),
);
export const diffRemovedLineGutter = registerColor(
  'diffEditorGutter.removedLineBackground',
  { dark: null, light: null, hcDark: null, hcLight: null },
  localize('diffEditorRemovedLineGutter', 'Background color for the margin where lines got removed.'),
);

export const diffOverviewRulerInserted = registerColor(
  'diffEditorOverview.insertedForeground',
  { dark: null, light: null, hcDark: null, hcLight: null },
  localize('diffEditorOverviewInserted', 'Diff overview ruler foreground for inserted content.'),
);
export const diffOverviewRulerRemoved = registerColor(
  'diffEditorOverview.removedForeground',
  { dark: null, light: null, hcDark: null, hcLight: null },
  localize('diffEditorOverviewRemoved', 'Diff overview ruler foreground for removed content.'),
);

export const diffInsertedOutline = registerColor(
  'diffEditor.insertedTextBorder',
  { dark: null, light: null, hcDark: '#33ff2eff', hcLight: '#374E06' },
  localize('diffEditorInsertedOutline', 'Outline color for the text that got inserted.'),
);
export const diffRemovedOutline = registerColor(
  'diffEditor.removedTextBorder',
  { dark: null, light: null, hcDark: '#FF008F', hcLight: '#AD0707' },
  localize('diffEditorRemovedOutline', 'Outline color for text that got removed.'),
);

export const diffBorder = registerColor(
  'diffEditor.border',
  { dark: null, light: null, hcDark: contrastBorder, hcLight: contrastBorder },
  localize('diffEditorBorder', 'Border color between the two text editors.'),
);
export const diffDiagonalFill = registerColor(
  'diffEditor.diagonalFill',
  { dark: '#cccccc33', light: '#22222233', hcDark: null, hcLight: null },
  localize(
    'diffDiagonalFill',
    "Color of the diff editor's diagonal fill. The diagonal fill is used in side-by-side diff views.",
  ),
);

/**
 * Merge Editor Colors
 */
export const defaultMergeEditorInsertColor = new Color(new RGBA(122, 255, 31, 0.12));
export const defaultMergeEditorRemoveColor = new Color(new RGBA(255, 21, 33, 0.12));
export const defaultMergeEditorModifyColor = new Color(new RGBA(255, 186, 29, 0.12));
export const mergeEditorInserted = registerColor(
  'mergeEditor.insertedBackground',
  { dark: defaultMergeEditorInsertColor, light: defaultMergeEditorInsertColor, hcDark: null, hcLight: null },
  '',
  true,
);
export const mergeEditorRemoved = registerColor(
  'mergeEditor.removedBackground',
  { dark: defaultMergeEditorRemoveColor, light: defaultMergeEditorRemoveColor, hcDark: null, hcLight: null },
  '',
  true,
);
export const mergeEditorModify = registerColor(
  'mergeEditor.modifyBackground',
  { dark: defaultMergeEditorModifyColor, light: defaultMergeEditorModifyColor, hcDark: null, hcLight: null },
  '',
  true,
);
export const mergeEditorInnerCharInserted = registerColor(
  'mergeEditor.insertedInnerCharColor',
  {
    dark: transparent(defaultMergeEditorInsertColor, 1),
    light: transparent(defaultMergeEditorInsertColor, 1),
    hcDark: null,
    hcLight: null,
  },
  '',
  true,
);
export const mergeEditorInnerCharRemoved = registerColor(
  'mergeEditor.removedInnerCharColor',
  {
    dark: transparent(defaultMergeEditorRemoveColor, 1),
    light: transparent(defaultMergeEditorRemoveColor, 1),
    hcDark: null,
    hcLight: null,
  },
  '',
  true,
);
export const mergeEditorInnerCharModify = registerColor(
  'mergeEditor.modifyInnerCharColor',
  {
    dark: transparent(defaultMergeEditorModifyColor, 1),
    light: transparent(defaultMergeEditorModifyColor, 1),
    hcDark: null,
    hcLight: null,
  },
  '',
  true,
);

/**
 * Editor View Colors from editorColorRegistry
 */
export const editorLineHighlight = registerColor(
  'editor.lineHighlightBackground',
  { dark: null, light: null, hcDark: null, hcLight: null },
  localize('lineHighlight', 'Background color for the highlight of line at the cursor position.'),
);
export const editorLineHighlightBorder = registerColor(
  'editor.lineHighlightBorder',
  { dark: '#282828', light: '#eeeeee', hcDark: '#f38518', hcLight: contrastBorder },
  localize('lineHighlightBorderBox', 'Background color for the border around the line at the cursor position.'),
);
export const editorRangeHighlight = registerColor(
  'editor.rangeHighlightBackground',
  { dark: '#ffffff0b', light: '#fdff0033', hcDark: null, hcLight: null },
  localize(
    'rangeHighlight',
    'Background color of highlighted ranges, like by quick open and find features. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
export const editorRangeHighlightBorder = registerColor(
  'editor.rangeHighlightBorder',
  { dark: null, light: null, hcDark: activeContrastBorder, hcLight: activeContrastBorder },
  localize('rangeHighlightBorder', 'Background color of the border around highlighted ranges.'),
  true,
);
export const editorSymbolHighlight = registerColor(
  'editor.symbolHighlightBackground',
  { dark: editorFindMatchHighlight, light: editorFindMatchHighlight, hcDark: null, hcLight: null },
  localize(
    'symbolHighlight',
    'Background color of highlighted symbol, like for go to definition or go next/previous symbol. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
export const editorSymbolHighlightBorder = registerColor(
  'editor.symbolHighlightBorder',
  { dark: null, light: null, hcDark: activeContrastBorder, hcLight: activeContrastBorder },
  localize('symbolHighlightBorder', 'Background color of the border around highlighted symbols.'),
  true,
);

export const editorCursorForeground = registerColor(
  'editorCursor.foreground',
  { dark: '#AEAFAD', light: Color.black, hcDark: Color.white, hcLight: '#0F4A85' },
  localize('caret', 'Color of the editor cursor.'),
);
export const editorCursorBackground = registerColor(
  'editorCursor.background',
  null,
  localize(
    'editorCursorBackground',
    'The background color of the editor cursor. Allows customizing the color of a character overlapped by a block cursor.',
  ),
);
export const editorWhitespaces = registerColor(
  'editorWhitespace.foreground',
  { dark: '#e3e4e229', light: '#33333333', hcDark: '#e3e4e229', hcLight: '#CCCCCC' },
  localize('editorWhitespaces', 'Color of whitespace characters in the editor.'),
);
export const editorIndentGuides = registerColor(
  'editorIndentGuide.background',
  { dark: editorWhitespaces, light: editorWhitespaces, hcDark: editorWhitespaces, hcLight: editorWhitespaces },
  localize('editorIndentGuides', 'Color of the editor indentation guides.'),
);
export const editorActiveIndentGuides = registerColor(
  'editorIndentGuide.activeBackground',
  { dark: editorWhitespaces, light: editorWhitespaces, hcDark: editorWhitespaces, hcLight: editorWhitespaces },
  localize('editorActiveIndentGuide', 'Color of the active editor indentation guides.'),
);
export const editorLineNumbers = registerColor(
  'editorLineNumber.foreground',
  { dark: '#858585', light: '#237893', hcDark: Color.white, hcLight: '#292929' },
  localize('editorLineNumbers', 'Color of editor line numbers.'),
);

const deprecatedEditorActiveLineNumber = registerColor(
  'editorActiveLineNumber.foreground',
  { dark: '#c6c6c6', light: '#0B216F', hcDark: activeContrastBorder, hcLight: activeContrastBorder },
  localize('editorActiveLineNumber', 'Color of editor active line number'),
  false,
  localize('deprecatedEditorActiveLineNumber', "Id is deprecated. Use 'editorLineNumber.activeForeground' instead."),
);
export const editorActiveLineNumber = registerColor(
  'editorLineNumber.activeForeground',
  {
    dark: deprecatedEditorActiveLineNumber,
    light: deprecatedEditorActiveLineNumber,
    hcDark: deprecatedEditorActiveLineNumber,
    hcLight: deprecatedEditorActiveLineNumber,
  },
  localize('editorActiveLineNumber', 'Color of editor active line number'),
);

export const editorRuler = registerColor(
  'editorRuler.foreground',
  { dark: '#5A5A5A', light: Color.lightgrey, hcDark: Color.white, hcLight: '#292929' },
  localize('editorRuler', 'Color of the editor rulers.'),
);

export const editorCodeLensForeground = registerColor(
  'editorCodeLens.foreground',
  { dark: '#999999', light: '#919191', hcDark: '#999999', hcLight: '#292929' },
  localize('editorCodeLensForeground', 'Foreground color of editor CodeLens'),
);

export const editorBracketMatchBackground = registerColor(
  'editorBracketMatch.background',
  { dark: '#0064001a', light: '#0064001a', hcDark: '#0064001a', hcLight: '#0000' },
  localize('editorBracketMatchBackground', 'Background color behind matching brackets'),
);
export const editorBracketMatchBorder = registerColor(
  'editorBracketMatch.border',
  { dark: '#888', light: '#B9B9B9', hcDark: contrastBorder, hcLight: contrastBorder },
  localize('editorBracketMatchBorder', 'Color for matching brackets boxes'),
);

export const editorOverviewRulerBorder = registerColor(
  'editorOverviewRuler.border',
  { dark: '#7f7f7f4d', light: '#7f7f7f4d', hcDark: '#7f7f7f4d', hcLight: '#666666' },
  localize('editorOverviewRulerBorder', 'Color of the overview ruler border.'),
);
export const editorOverviewRulerBackground = registerColor(
  'editorOverviewRuler.background',
  null,
  localize(
    'editorOverviewRulerBackground',
    'Background color of the editor overview ruler. Only used when the minimap is enabled and placed on the right side of the editor.',
  ),
);

export const editorGutter = registerColor(
  'editorGutter.background',
  { dark: editorBackground, light: editorBackground, hcDark: editorBackground, hcLight: editorBackground },
  localize(
    'editorGutter',
    'Background color of the editor gutter. The gutter contains the glyph margins and the line numbers.',
  ),
);

export const editorUnnecessaryCodeBorder = registerColor(
  'editorUnnecessaryCode.border',
  { dark: null, light: null, hcDark: Color.fromHex('#fff').transparent(0.8), hcLight: contrastBorder },
  localize('unnecessaryCodeBorder', 'Border color of unnecessary (unused) source code in the editor.'),
);
export const editorUnnecessaryCodeOpacity = registerColor(
  'editorUnnecessaryCode.opacity',
  { dark: Color.fromHex('#000a'), light: Color.fromHex('#0007'), hcDark: null, hcLight: null },
  localize(
    'unnecessaryCodeOpacity',
    'Opacity of unnecessary (unused) source code in the editor. For example, "#000000c0" will render the code with 75% opacity. For high contrast themes, use the  \'editorUnnecessaryCode.border\' theme color to underline unnecessary code instead of fading it out.',
  ),
);

const rulerRangeDefault = new Color(new RGBA(0, 122, 204, 0.6));
export const overviewRulerRangeHighlight = registerColor(
  'editorOverviewRuler.rangeHighlightForeground',
  { dark: rulerRangeDefault, light: rulerRangeDefault, hcDark: rulerRangeDefault, hcLight: rulerRangeDefault },
  localize(
    'overviewRulerRangeHighlight',
    'Overview ruler marker color for range highlights. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
export const overviewRulerError = registerColor(
  'editorOverviewRuler.errorForeground',
  {
    dark: new Color(new RGBA(255, 18, 18, 0.7)),
    light: new Color(new RGBA(255, 18, 18, 0.7)),
    hcDark: new Color(new RGBA(255, 50, 50, 1)),
    hcLight: '#B5200D',
  },
  localize('overviewRuleError', 'Overview ruler marker color for errors.'),
);
export const overviewRulerWarning = registerColor(
  'editorOverviewRuler.warningForeground',
  {
    dark: editorWarningForeground,
    light: editorWarningForeground,
    hcDark: editorWarningBorder,
    hcLight: editorWarningBorder,
  },
  localize('overviewRuleWarning', 'Overview ruler marker color for warnings.'),
);
export const overviewRulerInfo = registerColor(
  'editorOverviewRuler.infoForeground',
  { dark: editorInfoForeground, light: editorInfoForeground, hcDark: editorInfoBorder, hcLight: editorInfoBorder },
  localize('overviewRuleInfo', 'Overview ruler marker color for infos.'),
);

// < --- Editors --- >

export const EDITOR_PANE_BACKGROUND = registerColor(
  'editorPane.background',
  {
    dark: editorBackground,
    light: editorBackground,
    hcDark: editorBackground,
    hcLight: editorBackground,
  },
  localize(
    'editorPaneBackground',
    'Background color of the editor pane visible on the left and right side of the centered editor layout.',
  ),
);

export const EDITOR_GROUP_EMPTY_BACKGROUND = registerColor(
  'editorGroup.emptyBackground',
  {
    dark: null,
    light: null,
    hcDark: null,
    hcLight: null,
  },
  localize(
    'editorGroupEmptyBackground',
    'Background color of an empty editor group. Editor groups are the containers of editors.',
  ),
);

export const EDITOR_GROUP_FOCUSED_EMPTY_BORDER = registerColor(
  'editorGroup.focusedEmptyBorder',
  {
    dark: null,
    light: null,
    hcDark: focusBorder,
    hcLight: focusBorder,
  },
  localize(
    'editorGroupFocusedEmptyBorder',
    'Border color of an empty editor group that is focused. Editor groups are the containers of editors.',
  ),
);

export const EDITOR_GROUP_HEADER_TABS_BACKGROUND = registerColor(
  'editorGroupHeader.tabsBackground',
  {
    dark: '#252526',
    light: '#F3F3F3',
    hcDark: '#000000',
    hcLight: '#ffffff',
  },
  localize(
    'tabsContainerBackground',
    'Background color of the editor group title header when tabs are enabled. Editor groups are the containers of editors.',
  ),
);

export const EDITOR_GROUP_HEADER_TABS_BORDER = registerColor(
  'editorGroupHeader.tabsBorder',
  {
    dark: null,
    light: null,
    hcDark: null,
    hcLight: null,
  },
  localize(
    'tabsContainerBorder',
    'Border color of the editor group title header when tabs are enabled. Editor groups are the containers of editors.',
  ),
);

export const EDITOR_GROUP_HEADER_NO_TABS_BACKGROUND = registerColor(
  'editorGroupHeader.noTabsBackground',
  {
    dark: editorBackground,
    light: editorBackground,
    hcDark: editorBackground,
    hcLight: editorBackground,
  },
  localize(
    'editorGroupHeaderBackground',
    'Background color of the editor group title header when tabs are disabled (`"workbench.editor.showTabs": false`). Editor groups are the containers of editors.',
  ),
);

export const EDITOR_GROUP_HEADER_BORDER = registerColor(
  'editorGroupHeader.border',
  {
    dark: null,
    light: null,
    hcDark: contrastBorder,
    hcLight: contrastBorder,
  },
  localize(
    'editorTitleContainerBorder',
    'Border color of the editor group title header. Editor groups are the containers of editors.',
  ),
);

export const EDITOR_GROUP_BORDER = registerColor(
  'editorGroup.border',
  {
    dark: '#444444',
    light: '#E7E7E7',
    hcDark: contrastBorder,
    hcLight: contrastBorder,
  },
  localize(
    'editorGroupBorder',
    'Color to separate multiple editor groups from each other. Editor groups are the containers of editors.',
  ),
);

export const EDITOR_DRAG_AND_DROP_BACKGROUND = registerColor(
  'editorGroup.dropBackground',
  {
    dark: Color.fromHex('#53595D').transparent(0.5),
    light: Color.fromHex('#2677CB').transparent(0.18),
    hcDark: null,
    hcLight: Color.fromHex('#0F4A85').transparent(0.5),
  },
  localize(
    'editorDragAndDropBackground',
    'Background color when dragging editors around. The color should have transparency so that the editor contents can still shine through.',
  ),
);

export const EDITOR_DROP_INTO_PROMPT_FOREGROUND = registerColor(
  'editorGroup.dropIntoPromptForeground',
  {
    dark: editorWidgetForeground,
    light: editorWidgetForeground,
    hcDark: editorWidgetForeground,
    hcLight: editorWidgetForeground,
  },
  localize(
    'editorDropIntoPromptForeground',
    'Foreground color of text shown over editors when dragging files. This text informs the user that they can hold shift to drop into the editor.',
  ),
);

export const EDITOR_DROP_INTO_PROMPT_BACKGROUND = registerColor(
  'editorGroup.dropIntoPromptBackground',
  {
    dark: editorWidgetBackground,
    light: editorWidgetBackground,
    hcDark: editorWidgetBackground,
    hcLight: editorWidgetBackground,
  },
  localize(
    'editorDropIntoPromptBackground',
    'Background color of text shown over editors when dragging files. This text informs the user that they can hold shift to drop into the editor.',
  ),
);

export const EDITOR_DROP_INTO_PROMPT_BORDER = registerColor(
  'editorGroup.dropIntoPromptBorder',
  {
    dark: null,
    light: null,
    hcDark: contrastBorder,
    hcLight: contrastBorder,
  },
  localize(
    'editorDropIntoPromptBorder',
    'Border color of text shown over editors when dragging files. This text informs the user that they can hold shift to drop into the editor.',
  ),
);

export const SIDE_BY_SIDE_EDITOR_HORIZONTAL_BORDER = registerColor(
  'sideBySideEditor.horizontalBorder',
  {
    dark: EDITOR_GROUP_BORDER,
    light: EDITOR_GROUP_BORDER,
    hcDark: EDITOR_GROUP_BORDER,
    hcLight: EDITOR_GROUP_BORDER,
  },
  localize(
    'sideBySideEditor.horizontalBorder',
    'Color to separate two editors from each other when shown side by side in an editor group from top to bottom.',
  ),
);

export const SIDE_BY_SIDE_EDITOR_VERTICAL_BORDER = registerColor(
  'sideBySideEditor.verticalBorder',
  {
    dark: EDITOR_GROUP_BORDER,
    light: EDITOR_GROUP_BORDER,
    hcDark: EDITOR_GROUP_BORDER,
    hcLight: EDITOR_GROUP_BORDER,
  },
  localize(
    'sideBySideEditor.verticalBorder',
    'Color to separate two editors from each other when shown side by side in an editor group from left to right.',
  ),
);

/**
 * Inline hints
 */
export const editorInlayHintForeground = registerColor(
  'editorInlayHint.foreground',
  {
    dark: transparent(badgeForeground, 0.8),
    light: transparent(badgeForeground, 0.8),
    hcDark: badgeForeground,
    hcLight: badgeForeground,
  },
  localize('editorInlayHintForeground', 'Foreground color of inline hints'),
);
export const editorInlayHintBackground = registerColor(
  'editorInlayHint.background',
  {
    dark: transparent(badgeBackground, 0.6),
    light: transparent(badgeBackground, 0.3),
    hcDark: badgeBackground,
    hcLight: badgeBackground,
  },
  localize('editorInlayHintBackground', 'Background color of inline hints'),
);
export const editorInlayHintTypeForeground = registerColor(
  'editorInlayHint.typeForeground',
  {
    dark: editorInlayHintForeground,
    light: editorInlayHintForeground,
    hcDark: editorInlayHintForeground,
    hcLight: editorInlayHintForeground,
  },
  localize('editorInlayHintForegroundTypes', 'Foreground color of inline hints for types'),
);
export const editorInlayHintTypeBackground = registerColor(
  'editorInlayHint.typeBackground',
  {
    dark: editorInlayHintBackground,
    light: editorInlayHintBackground,
    hcDark: editorInlayHintBackground,
    hcLight: editorInlayHintBackground,
  },
  localize('editorInlayHintBackgroundTypes', 'Background color of inline hints for types'),
);
export const editorInlayHintParameterForeground = registerColor(
  'editorInlayHint.parameterForeground',
  {
    dark: editorInlayHintForeground,
    light: editorInlayHintForeground,
    hcDark: editorInlayHintForeground,
    hcLight: editorInlayHintForeground,
  },
  localize('editorInlayHintForegroundParameter', 'Foreground color of inline hints for parameters'),
);
export const editorInlayHintParameterBackground = registerColor(
  'editorInlayHint.parameterBackground',
  {
    dark: editorInlayHintBackground,
    light: editorInlayHintBackground,
    hcDark: editorInlayHintBackground,
    hcLight: editorInlayHintBackground,
  },
  localize('editorInlayHintBackgroundParameter', 'Background color of inline hints for parameters'),
);

export const editorImagePreviewBackground = registerColor(
  'editorImagePreview.background',
  {
    dark: new Color(new RGBA(20, 20, 20)),
    light: new Color(new RGBA(230, 230, 230)),
    hcLight: new Color(new RGBA(230, 230, 230)),
    hcDark: new Color(new RGBA(20, 20, 20)),
  },
  localize('editorImagePreviewBackground', 'Background color of image preview editor.'),
);

export const ghostTextBorder = registerColor(
  'editorGhostText.border',
  {
    dark: null,
    light: null,
    hcDark: Color.fromHex('#fff').transparent(0.8),
    hcLight: Color.fromHex('#292929').transparent(0.8),
  },
  localize('editorGhostTextBorder', 'Border color of ghost text in the editor.'),
);
export const ghostTextForeground = registerColor(
  'editorGhostText.foreground',
  {
    dark: Color.fromHex('#ffffff56'),
    light: Color.fromHex('#0007'),
    hcDark: null,
    hcLight: null,
  },
  localize('editorGhostTextForeground', 'Foreground color of the ghost text in the editor.'),
);
export const ghostTextBackground = registerColor(
  'editorGhostText.background',
  {
    dark: null,
    light: null,
    hcDark: null,
    hcLight: null,
  },
  localize('editorGhostTextBackground', 'Background color of the ghost text in the editor.'),
);
