import { localize } from '@opensumi/ide-core-common';

import { Color, RGBA } from '../../common/color';
import { registerColor, transparent, lighten, darken, lessProminent } from '../color-registry';

import { badgeBackground, badgeForeground } from './badge';
import { contrastBorder, activeContrastBorder, focusBorder, foreground } from './base';
import { backgroundColor, foregroundColor } from './basic-color';

export const editorErrorForeground = registerColor(
  'editorError.foreground',
  { dark: '#F48771', light: '#E51400', hc: null },
  localize('editorError.foreground', 'Foreground color of error squigglies in the editor.'),
);
export const editorErrorBorder = registerColor(
  'editorError.border',
  { dark: null, light: null, hc: Color.fromHex('#E47777').transparent(0.8) },
  localize('errorBorder', 'Border color of error boxes in the editor.'),
);

export const editorWarningForeground = registerColor(
  'editorWarning.foreground',
  { dark: '#CCA700', light: '#E9A700', hc: null },
  localize('editorWarning.foreground', 'Foreground color of warning squigglies in the editor.'),
);
export const editorWarningBorder = registerColor(
  'editorWarning.border',
  { dark: null, light: null, hc: Color.fromHex('#FFCC00').transparent(0.8) },
  localize('warningBorder', 'Border color of warning boxes in the editor.'),
);

export const editorInfoForeground = registerColor(
  'editorInfo.foreground',
  { dark: '#75BEFF', light: '#75BEFF', hc: null },
  localize('editorInfo.foreground', 'Foreground color of info squigglies in the editor.'),
);
export const editorInfoBorder = registerColor(
  'editorInfo.border',
  { dark: null, light: null, hc: Color.fromHex('#71B771').transparent(0.8) },
  localize('infoBorder', 'Border color of info boxes in the editor.'),
);

export const editorHintForeground = registerColor(
  'editorHint.foreground',
  { dark: Color.fromHex('#eeeeee').transparent(0.7), light: '#6c6c6c', hc: null },
  localize('editorHint.foreground', 'Foreground color of hint squigglies in the editor.'),
);
export const editorHintBorder = registerColor(
  'editorHint.border',
  { dark: null, light: null, hc: Color.fromHex('#eeeeee').transparent(0.8) },
  localize('hintBorder', 'Border color of hint boxes in the editor.'),
);

/**
 * Editor background color.
 * Because of bug https://monacotools.visualstudio.com/DefaultCollection/Monaco/_workitems/edit/13254
 * we are *not* using the color white (or #ffffff, rgba(255,255,255)) but something very close to white.
 */
export const editorBackground = registerColor(
  'editor.background',
  { light: '#fffffe', dark: '#1E1E1E', hc: backgroundColor },
  localize('editorBackground', 'Editor background color.'),
);

/**
 * Editor foreground color.
 */
export const editorForeground = registerColor(
  'editor.foreground',
  { light: '#333333', dark: '#BBBBBB', hc: foregroundColor },
  localize('editorForeground', 'Editor default foreground color.'),
);

/**
 * Editor widgets
 */
export const editorWidgetForeground = registerColor(
  'editorWidget.foreground',
  { dark: foreground, light: foreground, hc: foreground },
  localize('editorWidgetForeground', 'Foreground color of editor widgets, such as find/replace.'),
);
export const editorWidgetBackground = registerColor(
  'editorWidget.background',
  { dark: '#252526', light: '#F3F3F3', hc: '#0C141F' },
  localize('editorWidgetBackground', 'Background color of editor widgets, such as find/replace.'),
);
export const editorWidgetBorder = registerColor(
  'editorWidget.border',
  { dark: '#454545', light: '#C8C8C8', hc: contrastBorder },
  localize(
    'editorWidgetBorder',
    'Border color of editor widgets. The color is only used if the widget chooses to have a border and if the color is not overridden by a widget.',
  ),
);

export const editorWidgetResizeBorder = registerColor(
  'editorWidget.resizeBorder',
  { light: null, dark: null, hc: null },
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
  { light: '#ADD6FF', dark: '#264F78', hc: '#f3f518' },
  localize('editorSelectionBackground', 'Color of the editor selection.'),
);
export const editorSelectionForeground = registerColor(
  'editor.selectionForeground',
  { light: null, dark: null, hc: '#000000' },
  localize('editorSelectionForeground', 'Color of the selected text for high contrast.'),
);
export const editorInactiveSelection = registerColor(
  'editor.inactiveSelectionBackground',
  {
    light: transparent(editorSelectionBackground, 0.5),
    dark: transparent(editorSelectionBackground, 0.5),
    hc: transparent(editorSelectionBackground, 0.5),
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
    hc: null,
  },
  localize(
    'editorSelectionHighlight',
    'Color for regions with the same content as the selection. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
export const editorSelectionHighlightBorder = registerColor(
  'editor.selectionHighlightBorder',
  { light: null, dark: null, hc: activeContrastBorder },
  localize('editorSelectionHighlightBorder', 'Border color for regions with the same content as the selection.'),
);

/**
 * Editor find match colors.
 */
export const editorFindMatch = registerColor(
  'editor.findMatchBackground',
  { light: '#A8AC94', dark: '#515C6A', hc: null },
  localize('editorFindMatch', 'Color of the current search match.'),
);
export const editorFindMatchHighlight = registerColor(
  'editor.findMatchHighlightBackground',
  { light: '#EA5C0055', dark: '#EA5C0055', hc: null },
  localize(
    'findMatchHighlight',
    'Color of the other search matches. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
export const editorFindRangeHighlight = registerColor(
  'editor.findRangeHighlightBackground',
  { dark: '#3a3d4166', light: '#b4b4b44d', hc: null },
  localize(
    'findRangeHighlight',
    'Color of the range limiting the search. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
export const editorFindMatchBorder = registerColor(
  'editor.findMatchBorder',
  { light: null, dark: null, hc: activeContrastBorder },
  localize('editorFindMatchBorder', 'Border color of the current search match.'),
);
export const editorFindMatchHighlightBorder = registerColor(
  'editor.findMatchHighlightBorder',
  { light: null, dark: null, hc: activeContrastBorder },
  localize('findMatchHighlightBorder', 'Border color of the other search matches.'),
);
export const editorFindRangeHighlightBorder = registerColor(
  'editor.findRangeHighlightBorder',
  { dark: null, light: null, hc: transparent(activeContrastBorder, 0.4) },
  localize(
    'findRangeHighlightBorder',
    'Border color of the range limiting the search. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);

/**
 * Editor hover
 */
export const editorHoverHighlight = registerColor(
  'editor.hoverHighlightBackground',
  { light: '#ADD6FF26', dark: '#264f7840', hc: '#ADD6FF26' },
  localize(
    'hoverHighlight',
    'Highlight below the word for which a hover is shown. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
export const editorHoverBackground = registerColor(
  'editorHoverWidget.background',
  { light: editorWidgetBackground, dark: editorWidgetBackground, hc: editorWidgetBackground },
  localize('hoverBackground', 'Background color of the editor hover.'),
);
export const editorHoverBorder = registerColor(
  'editorHoverWidget.border',
  { light: editorWidgetBorder, dark: editorWidgetBorder, hc: editorWidgetBorder },
  localize('hoverBorder', 'Border color of the editor hover.'),
);
export const editorHoverStatusBarBackground = registerColor(
  'editorHoverWidget.statusBarBackground',
  { dark: lighten(editorHoverBackground, 0.2), light: darken(editorHoverBackground, 0.05), hc: editorWidgetBackground },
  localize('statusBarBackground', 'Background color of the editor hover status bar.'),
);

/**
 * Editor link colors
 */
export const editorActiveLinkForeground = registerColor(
  'editorLink.activeForeground',
  { dark: '#4E94CE', light: Color.blue, hc: Color.cyan },
  localize('activeLinkForeground', 'Color of active links.'),
);

/**
 * Diff Editor Colors
 */
export const defaultInsertColor = new Color(new RGBA(155, 185, 85, 0.2));
export const defaultRemoveColor = new Color(new RGBA(255, 0, 0, 0.2));

export const diffInserted = registerColor(
  'diffEditor.insertedTextBackground',
  { dark: defaultInsertColor, light: defaultInsertColor, hc: null },
  localize(
    'diffEditorInserted',
    'Background color for text that got inserted. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
export const diffRemoved = registerColor(
  'diffEditor.removedTextBackground',
  { dark: defaultRemoveColor, light: defaultRemoveColor, hc: null },
  localize(
    'diffEditorRemoved',
    'Background color for text that got removed. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);

export const diffInsertedOutline = registerColor(
  'diffEditor.insertedTextBorder',
  { dark: null, light: null, hc: '#33ff2eff' },
  localize('diffEditorInsertedOutline', 'Outline color for the text that got inserted.'),
);
export const diffRemovedOutline = registerColor(
  'diffEditor.removedTextBorder',
  { dark: null, light: null, hc: '#FF008F' },
  localize('diffEditorRemovedOutline', 'Outline color for text that got removed.'),
);

export const diffBorder = registerColor(
  'diffEditor.border',
  { dark: null, light: null, hc: contrastBorder },
  localize('diffEditorBorder', 'Border color between the two text editors.'),
);

/**
 * Editor View Colors from editorColorRegistry
 */
export const editorLineHighlight = registerColor(
  'editor.lineHighlightBackground',
  { dark: null, light: null, hc: null },
  localize('lineHighlight', 'Background color for the highlight of line at the cursor position.'),
);
export const editorLineHighlightBorder = registerColor(
  'editor.lineHighlightBorder',
  { dark: '#282828', light: '#eeeeee', hc: '#f38518' },
  localize('lineHighlightBorderBox', 'Background color for the border around the line at the cursor position.'),
);
export const editorRangeHighlight = registerColor(
  'editor.rangeHighlightBackground',
  { dark: '#ffffff0b', light: '#fdff0033', hc: null },
  localize(
    'rangeHighlight',
    'Background color of highlighted ranges, like by quick open and find features. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
export const editorRangeHighlightBorder = registerColor(
  'editor.rangeHighlightBorder',
  { dark: null, light: null, hc: activeContrastBorder },
  localize('rangeHighlightBorder', 'Background color of the border around highlighted ranges.'),
  true,
);

export const editorCursorForeground = registerColor(
  'editorCursor.foreground',
  { dark: '#AEAFAD', light: Color.black, hc: Color.white },
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
  { dark: '#e3e4e229', light: '#33333333', hc: '#e3e4e229' },
  localize('editorWhitespaces', 'Color of whitespace characters in the editor.'),
);
export const editorIndentGuides = registerColor(
  'editorIndentGuide.background',
  { dark: editorWhitespaces, light: editorWhitespaces, hc: editorWhitespaces },
  localize('editorIndentGuides', 'Color of the editor indentation guides.'),
);
export const editorActiveIndentGuides = registerColor(
  'editorIndentGuide.activeBackground',
  { dark: editorWhitespaces, light: editorWhitespaces, hc: editorWhitespaces },
  localize('editorActiveIndentGuide', 'Color of the active editor indentation guides.'),
);
export const editorLineNumbers = registerColor(
  'editorLineNumber.foreground',
  { dark: '#858585', light: '#237893', hc: Color.white },
  localize('editorLineNumbers', 'Color of editor line numbers.'),
);

const deprecatedEditorActiveLineNumber = registerColor(
  'editorActiveLineNumber.foreground',
  { dark: '#c6c6c6', light: '#0B216F', hc: activeContrastBorder },
  localize('editorActiveLineNumber', 'Color of editor active line number'),
  false,
  localize('deprecatedEditorActiveLineNumber', "Id is deprecated. Use 'editorLineNumber.activeForeground' instead."),
);
export const editorActiveLineNumber = registerColor(
  'editorLineNumber.activeForeground',
  {
    dark: deprecatedEditorActiveLineNumber,
    light: deprecatedEditorActiveLineNumber,
    hc: deprecatedEditorActiveLineNumber,
  },
  localize('editorActiveLineNumber', 'Color of editor active line number'),
);

export const editorRuler = registerColor(
  'editorRuler.foreground',
  { dark: '#5A5A5A', light: Color.lightgrey, hc: Color.white },
  localize('editorRuler', 'Color of the editor rulers.'),
);

export const editorCodeLensForeground = registerColor(
  'editorCodeLens.foreground',
  { dark: '#999999', light: '#999999', hc: '#999999' },
  localize('editorCodeLensForeground', 'Foreground color of editor code lenses'),
);

export const editorBracketMatchBackground = registerColor(
  'editorBracketMatch.background',
  { dark: '#0064001a', light: '#0064001a', hc: '#0064001a' },
  localize('editorBracketMatchBackground', 'Background color behind matching brackets'),
);
export const editorBracketMatchBorder = registerColor(
  'editorBracketMatch.border',
  { dark: '#888', light: '#B9B9B9', hc: '#fff' },
  localize('editorBracketMatchBorder', 'Color for matching brackets boxes'),
);

export const editorOverviewRulerBorder = registerColor(
  'editorOverviewRuler.border',
  { dark: '#7f7f7f4d', light: '#7f7f7f4d', hc: '#7f7f7f4d' },
  localize('editorOverviewRulerBorder', 'Color of the overview ruler border.'),
);
const overviewRulerDefault = new Color(new RGBA(197, 197, 197, 1));
export const editorGutter = registerColor(
  'editorGutter.background',
  { dark: editorBackground, light: editorBackground, hc: editorBackground },
  localize(
    'editorGutter',
    'Background color of the editor gutter. The gutter contains the glyph margins and the line numbers.',
  ),
);
export const overviewRulerCommentingRangeForeground = registerColor(
  'editorGutter.commentRangeForeground',
  { dark: overviewRulerDefault, light: overviewRulerDefault, hc: overviewRulerDefault },
  localize('editorGutterCommentRangeForeground', 'Editor gutter decoration color for commenting ranges.'),
);
export const editorUnnecessaryCodeBorder = registerColor(
  'editorUnnecessaryCode.border',
  { dark: null, light: null, hc: Color.fromHex('#fff').transparent(0.8) },
  localize('unnecessaryCodeBorder', 'Border color of unnecessary (unused) source code in the editor.'),
);
export const editorUnnecessaryCodeOpacity = registerColor(
  'editorUnnecessaryCode.opacity',
  { dark: Color.fromHex('#000a'), light: Color.fromHex('#0007'), hc: null },
  localize(
    'unnecessaryCodeOpacity',
    'Opacity of unnecessary (unused) source code in the editor. For example, "#000000c0" will render the code with 75% opacity. For high contrast themes, use the  \'editorUnnecessaryCode.border\' theme color to underline unnecessary code instead of fading it out.',
  ),
);

const rulerRangeDefault = new Color(new RGBA(0, 122, 204, 0.6));
export const overviewRulerRangeHighlight = registerColor(
  'editorOverviewRuler.rangeHighlightForeground',
  { dark: rulerRangeDefault, light: rulerRangeDefault, hc: rulerRangeDefault },
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
    hc: new Color(new RGBA(255, 50, 50, 1)),
  },
  localize('overviewRuleError', 'Overview ruler marker color for errors.'),
);
export const overviewRulerWarning = registerColor(
  'editorOverviewRuler.warningForeground',
  { dark: editorWarningForeground, light: editorWarningForeground, hc: editorWarningBorder },
  localize('overviewRuleWarning', 'Overview ruler marker color for warnings.'),
);
export const overviewRulerInfo = registerColor(
  'editorOverviewRuler.infoForeground',
  { dark: editorInfoForeground, light: editorInfoForeground, hc: editorInfoBorder },
  localize('overviewRuleInfo', 'Overview ruler marker color for infos.'),
);

// < --- Editors --- >

export const EDITOR_PANE_BACKGROUND = registerColor(
  'editorPane.background',
  {
    dark: editorBackground,
    light: editorBackground,
    hc: editorBackground,
  },
  localize(
    'editorPaneBackground',
    'Background color of the editor pane visible on the left and right side of the centered editor layout.',
  ),
);

registerColor(
  'editorGroup.background',
  {
    dark: null,
    light: null,
    hc: null,
  },
  localize('editorGroupBackground', 'Deprecated background color of an editor group.'),
  false,
  localize(
    'deprecatedEditorGroupBackground',
    'Deprecated: Background color of an editor group is no longer being supported with the introduction of the grid editor layout. You can use editorGroup.emptyBackground to set the background color of empty editor groups.',
  ),
);

export const EDITOR_GROUP_EMPTY_BACKGROUND = registerColor(
  'editorGroup.emptyBackground',
  {
    dark: null,
    light: null,
    hc: null,
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
    hc: focusBorder,
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
    hc: null,
  },
  localize(
    'tabsContainerBackground',
    'Background color of the editor group title header when tabs are enabled. Editor groups are the containers of editors.',
  ),
);

export const EDITOR_GROUP_HEADER_NO_TABS_BACKGROUND = registerColor(
  'editorGroupHeader.noTabsBackground',
  {
    dark: editorBackground,
    light: editorBackground,
    hc: editorBackground,
  },
  localize(
    'editorGroupHeaderBackground',
    'Background color of the editor group title header when tabs are disabled (`"workbench.editor.showTabs": false`). Editor groups are the containers of editors.',
  ),
);

export const EDITOR_GROUP_BORDER = registerColor(
  'editorGroup.border',
  {
    dark: '#444444',
    light: '#E7E7E7',
    hc: contrastBorder,
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
    hc: null,
  },
  localize(
    'editorDragAndDropBackground',
    'Background color when dragging editors around. The color should have transparency so that the editor contents can still shine through.',
  ),
);

/**
 * Inline hints
 */
export const editorInlayHintForeground = registerColor(
  'editorInlayHint.foreground',
  { dark: transparent(badgeForeground, 0.8), light: transparent(badgeForeground, 0.8), hc: badgeForeground },
  localize('editorInlayHintForeground', 'Foreground color of inline hints'),
);
export const editorInlayHintBackground = registerColor(
  'editorInlayHint.background',
  { dark: transparent(badgeBackground, 0.6), light: transparent(badgeBackground, 0.3), hc: badgeBackground },
  localize('editorInlayHintBackground', 'Background color of inline hints'),
);
export const editorInlayHintTypeForeground = registerColor(
  'editorInlayHintType.foreground',
  { dark: transparent(badgeForeground, 0.8), light: transparent(badgeForeground, 0.8), hc: badgeForeground },
  localize('editorInlayHintForegroundTypes', 'Foreground color of inline hints for types'),
);
export const editorInlayHintTypeBackground = registerColor(
  'editorInlayHintType.background',
  { dark: transparent(badgeBackground, 0.6), light: transparent(badgeBackground, 0.3), hc: badgeBackground },
  localize('editorInlayHintBackgroundTypes', 'Background color of inline hints for types'),
);
export const editorInlayHintParameterForeground = registerColor(
  'editorInlayHintParameter.foreground',
  { dark: transparent(badgeForeground, 0.8), light: transparent(badgeForeground, 0.8), hc: badgeForeground },
  localize('editorInlayHintForegroundParameter', 'Foreground color of inline hints for parameters'),
);
export const editorInlayHintParameterBackground = registerColor(
  'editorInlayHintParameter.background',
  { dark: transparent(badgeBackground, 0.6), light: transparent(badgeBackground, 0.3), hc: badgeBackground },
  localize('editorInlayHintBackgroundParameter', 'Background color of inline hints for parameters'),
);
