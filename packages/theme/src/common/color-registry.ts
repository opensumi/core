/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Color, RGBA } from '../common/color';
import { ITheme, ColorIdentifier, ColorDefaults, ColorContribution, ColorValue, ColorFunction } from '../common/theme.service';
import { localize } from '@ali/ide-core-common';

//  ------ API types

// color registry
export const Extensions = {
  ColorContribution: 'base.contributions.colors',
};

export interface IColorRegistry {

  /**
   * Register a color to the registry.
   * @param id The color id as used in theme description files
   * @param defaults The default values
   * @description the description
   */
  registerColor(id: string, defaults: ColorDefaults, description: string): ColorIdentifier;

  /**
   * Register a color to the registry.
   */
  deregisterColor(id: string): void;

  /**
   * Get all color contributions
   */
  getColors(): ColorContribution[];

  /**
   * Gets the default color of the given id
   */
  resolveDefaultColor(id: ColorIdentifier, theme: ITheme): Color | undefined;

}

class ColorRegistry implements IColorRegistry {

  private colorsById: { [key: string]: ColorContribution };

  constructor() {
    this.colorsById = {};
  }

  public registerColor(id: string, defaults: ColorDefaults | null, description: string, needsTransparency = false, deprecationMessage?: string): ColorIdentifier {
    const colorContribution: ColorContribution = { id, description, defaults, needsTransparency, deprecationMessage };
    this.colorsById[id] = colorContribution;
    return id;
  }

  public deregisterColor(id: string): void {
    delete this.colorsById[id];
  }

  public getColors(): ColorContribution[] {
    return Object.keys(this.colorsById).map((id) => this.colorsById[id]);
  }

  public resolveDefaultColor(id: ColorIdentifier, theme: ITheme): Color | undefined {
    const colorDesc = this.colorsById[id];
    if (colorDesc && colorDesc.defaults) {
      const colorValue = colorDesc.defaults[theme.type];
      return resolveColorValue(colorValue, theme);
    }
    return undefined;
  }

  public toString() {
    const sorter = (a: string, b: string) => {
      const cat1 = a.indexOf('.') === -1 ? 0 : 1;
      const cat2 = b.indexOf('.') === -1 ? 0 : 1;
      if (cat1 !== cat2) {
        return cat1 - cat2;
      }
      return a.localeCompare(b);
    };

    return Object.keys(this.colorsById).sort(sorter).map((k) => `- \`${k}\`: ${this.colorsById[k].description}`).join('\n');
  }

}

const colorRegistry = new ColorRegistry();

export function registerColor(id: string, defaults: ColorDefaults | null, description: string, needsTransparency?: boolean, deprecationMessage?: string): ColorIdentifier {
  return colorRegistry.registerColor(id, defaults, description, needsTransparency, deprecationMessage);
}

export function getColorRegistry(): IColorRegistry {
  return colorRegistry;
}

// ----- base colors

export const foreground = registerColor('foreground', { dark: '#CCCCCC', light: '#616161', hc: '#FFFFFF' }, localize('foreground', 'Overall foreground color. This color is only used if not overridden by a component.'));
export const errorForeground = registerColor('errorForeground', { dark: '#F48771', light: '#A1260D', hc: '#F48771' }, localize('errorForeground', 'Overall foreground color for error messages. This color is only used if not overridden by a component.'));
export const descriptionForeground = registerColor('descriptionForeground', { light: '#717171', dark: transparent(foreground, 0.7), hc: transparent(foreground, 0.7) }, localize('descriptionForeground', 'Foreground color for description text providing additional information, for example for a label.'));

export const focusBorder = registerColor('focusBorder', { dark: Color.fromHex('#0E639C').transparent(0.8), light: Color.fromHex('#007ACC').transparent(0.4), hc: '#F38518' }, localize('focusBorder', 'Overall border color for focused elements. This color is only used if not overridden by a component.'));

export const contrastBorder = registerColor('contrastBorder', { light: null, dark: null, hc: '#6FC3DF' }, localize('contrastBorder', 'An extra border around elements to separate them from others for greater contrast.'));
export const activeContrastBorder = registerColor('contrastActiveBorder', { light: null, dark: null, hc: focusBorder }, localize('activeContrastBorder', 'An extra border around active elements to separate them from others for greater contrast.'));

export const selectionBackground = registerColor('selection.background', { light: null, dark: null, hc: null }, localize('selectionBackground', 'The background color of text selections in the workbench (e.g. for input fields or text areas). Note that this does not apply to selections within the editor.'));

// ------ text colors

export const textSeparatorForeground = registerColor('textSeparator.foreground', { light: '#0000002e', dark: '#ffffff2e', hc: Color.black }, localize('textSeparatorForeground', 'Color for text separators.'));
export const textLinkForeground = registerColor('textLink.foreground', { light: '#006AB1', dark: '#3794FF', hc: '#3794FF' }, localize('textLinkForeground', 'Foreground color for links in text.'));
export const textLinkActiveForeground = registerColor('textLink.activeForeground', { light: '#006AB1', dark: '#3794FF', hc: '#3794FF' }, localize('textLinkActiveForeground', 'Foreground color for links in text when clicked on and on mouse hover.'));
export const textPreformatForeground = registerColor('textPreformat.foreground', { light: '#A31515', dark: '#D7BA7D', hc: '#D7BA7D' }, localize('textPreformatForeground', 'Foreground color for preformatted text segments.'));
export const textBlockQuoteBackground = registerColor('textBlockQuote.background', { light: '#7f7f7f1a', dark: '#7f7f7f1a', hc: null }, localize('textBlockQuoteBackground', 'Background color for block quotes in text.'));
export const textBlockQuoteBorder = registerColor('textBlockQuote.border', { light: '#007acc80', dark: '#007acc80', hc: Color.white }, localize('textBlockQuoteBorder', 'Border color for block quotes in text.'));
export const textCodeBlockBackground = registerColor('textCodeBlock.background', { light: '#dcdcdc66', dark: '#0a0a0a66', hc: Color.black }, localize('textCodeBlockBackground', 'Background color for code blocks in text.'));

// ----- widgets
export const widgetShadow = registerColor('widget.shadow', { dark: '#000000', light: '#A8A8A8', hc: null }, localize('widgetShadow', 'Shadow color of widgets such as find/replace inside the editor.'));

export const inputBackground = registerColor('input.background', { dark: '#3C3C3C', light: Color.white, hc: Color.black }, localize('inputBoxBackground', 'Input box background.'));
export const inputForeground = registerColor('input.foreground', { dark: foreground, light: foreground, hc: foreground }, localize('inputBoxForeground', 'Input box foreground.'));
export const inputBorder = registerColor('input.border', { dark: null, light: null, hc: contrastBorder }, localize('inputBoxBorder', 'Input box border.'));
export const inputActiveOptionBorder = registerColor('inputOption.activeBorder', { dark: '#007ACC', light: '#007ACC', hc: activeContrastBorder }, localize('inputBoxActiveOptionBorder', 'Border color of activated options in input fields.'));
export const inputPlaceholderForeground = registerColor('input.placeholderForeground', { light: transparent(foreground, 0.5), dark: transparent(foreground, 0.5), hc: transparent(foreground, 0.7) }, localize('inputPlaceholderForeground', 'Input box foreground color for placeholder text.'));

export const inputValidationInfoBackground = registerColor('inputValidation.infoBackground', { dark: '#063B49', light: '#D6ECF2', hc: Color.black }, localize('inputValidationInfoBackground', 'Input validation background color for information severity.'));
export const inputValidationInfoForeground = registerColor('inputValidation.infoForeground', { dark: null, light: null, hc: null }, localize('inputValidationInfoForeground', 'Input validation foreground color for information severity.'));
export const inputValidationInfoBorder = registerColor('inputValidation.infoBorder', { dark: '#007acc', light: '#007acc', hc: contrastBorder }, localize('inputValidationInfoBorder', 'Input validation border color for information severity.'));
export const inputValidationWarningBackground = registerColor('inputValidation.warningBackground', { dark: '#352A05', light: '#F6F5D2', hc: Color.black }, localize('inputValidationWarningBackground', 'Input validation background color for warning severity.'));
export const inputValidationWarningForeground = registerColor('inputValidation.warningForeground', { dark: null, light: null, hc: null }, localize('inputValidationWarningForeground', 'Input validation foreground color for warning severity.'));
export const inputValidationWarningBorder = registerColor('inputValidation.warningBorder', { dark: '#B89500', light: '#B89500', hc: contrastBorder }, localize('inputValidationWarningBorder', 'Input validation border color for warning severity.'));
export const inputValidationErrorBackground = registerColor('inputValidation.errorBackground', { dark: '#5A1D1D', light: '#F2DEDE', hc: Color.black }, localize('inputValidationErrorBackground', 'Input validation background color for error severity.'));
export const inputValidationErrorForeground = registerColor('inputValidation.errorForeground', { dark: null, light: null, hc: null }, localize('inputValidationErrorForeground', 'Input validation foreground color for error severity.'));
export const inputValidationErrorBorder = registerColor('inputValidation.errorBorder', { dark: '#BE1100', light: '#BE1100', hc: contrastBorder }, localize('inputValidationErrorBorder', 'Input validation border color for error severity.'));

export const selectBackground = registerColor('dropdown.background', { dark: '#3C3C3C', light: Color.white, hc: Color.black }, localize('dropdownBackground', 'Dropdown background.'));
export const selectListBackground = registerColor('dropdown.listBackground', { dark: null, light: null, hc: Color.black }, localize('dropdownListBackground', 'Dropdown list background.'));
export const selectForeground = registerColor('dropdown.foreground', { dark: '#F0F0F0', light: null, hc: Color.white }, localize('dropdownForeground', 'Dropdown foreground.'));
export const selectBorder = registerColor('dropdown.border', { dark: selectBackground, light: '#CECECE', hc: contrastBorder }, localize('dropdownBorder', 'Dropdown border.'));

export const listFocusBackground = registerColor('list.focusBackground', { dark: '#062F4A', light: '#D6EBFF', hc: null }, localize('listFocusBackground', 'List/Tree background color for the focused item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.'));
export const listFocusForeground = registerColor('list.focusForeground', { dark: null, light: null, hc: null }, localize('listFocusForeground', 'List/Tree foreground color for the focused item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.'));
export const listActiveSelectionBackground = registerColor('list.activeSelectionBackground', { dark: '#094771', light: '#0074E8', hc: null }, localize('listActiveSelectionBackground', 'List/Tree background color for the selected item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.'));
export const listActiveSelectionForeground = registerColor('list.activeSelectionForeground', { dark: Color.white, light: Color.white, hc: null }, localize('listActiveSelectionForeground', 'List/Tree foreground color for the selected item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not.'));
export const listInactiveSelectionBackground = registerColor('list.inactiveSelectionBackground', { dark: '#37373D', light: '#E4E6F1', hc: null }, localize('listInactiveSelectionBackground', 'List/Tree background color for the selected item when the list/tree is inactive. An active list/tree has keyboard focus, an inactive does not.'));
export const listInactiveSelectionForeground = registerColor('list.inactiveSelectionForeground', { dark: null, light: null, hc: null }, localize('listInactiveSelectionForeground', 'List/Tree foreground color for the selected item when the list/tree is inactive. An active list/tree has keyboard focus, an inactive does not.'));
export const listInactiveFocusBackground = registerColor('list.inactiveFocusBackground', { dark: null, light: null, hc: null }, localize('listInactiveFocusBackground', 'List/Tree background color for the focused item when the list/tree is inactive. An active list/tree has keyboard focus, an inactive does not.'));
export const listHoverBackground = registerColor('list.hoverBackground', { dark: '#2A2D2E', light: '#F0F0F0', hc: null }, localize('listHoverBackground', 'List/Tree background when hovering over items using the mouse.'));
export const listHoverForeground = registerColor('list.hoverForeground', { dark: null, light: null, hc: null }, localize('listHoverForeground', 'List/Tree foreground when hovering over items using the mouse.'));
export const listDropBackground = registerColor('list.dropBackground', { dark: listFocusBackground, light: listFocusBackground, hc: null }, localize('listDropBackground', 'List/Tree drag and drop background when moving items around using the mouse.'));
export const listHighlightForeground = registerColor('list.highlightForeground', { dark: '#0097fb', light: '#0066BF', hc: focusBorder }, localize('highlight', 'List/Tree foreground color of the match highlights when searching inside the list/tree.'));
export const listInvalidItemForeground = registerColor('list.invalidItemForeground', { dark: '#B89500', light: '#B89500', hc: '#B89500' }, localize('invalidItemForeground', 'List/Tree foreground color for invalid items, for example an unresolved root in explorer.'));
export const listErrorForeground = registerColor('list.errorForeground', { dark: '#F88070', light: '#B01011', hc: null }, localize('listErrorForeground', 'Foreground color of list items containing errors.'));
export const listWarningForeground = registerColor('list.warningForeground', { dark: '#CCA700', light: '#855F00', hc: null }, localize('listWarningForeground', 'Foreground color of list items containing warnings.'));
export const listFilterWidgetBackground = registerColor('listFilterWidget.background', { light: '#efc1ad', dark: '#653723', hc: Color.black }, localize('listFilterWidgetBackground', 'Background color of the type filter widget in lists and trees.'));
export const listFilterWidgetOutline = registerColor('listFilterWidget.outline', { dark: Color.transparent, light: Color.transparent, hc: '#f38518' }, localize('listFilterWidgetOutline', 'Outline color of the type filter widget in lists and trees.'));
export const listFilterWidgetNoMatchesOutline = registerColor('listFilterWidget.noMatchesOutline', { dark: '#BE1100', light: '#BE1100', hc: contrastBorder }, localize('listFilterWidgetNoMatchesOutline', 'Outline color of the type filter widget in lists and trees, when there are no matches.'));
export const treeIndentGuidesStroke = registerColor('tree.indentGuidesStroke', { dark: '#585858', light: '#a9a9a9', hc: '#a9a9a9' }, localize('treeIndentGuidesStroke', 'Tree stroke color for the indentation guides.'));

export const pickerGroupForeground = registerColor('pickerGroup.foreground', { dark: '#3794FF', light: '#0066BF', hc: Color.white }, localize('pickerGroupForeground', 'Quick picker color for grouping labels.'));
export const pickerGroupBorder = registerColor('pickerGroup.border', { dark: '#3F3F46', light: '#CCCEDB', hc: Color.white }, localize('pickerGroupBorder', 'Quick picker color for grouping borders.'));

export const buttonForeground = registerColor('button.foreground', { dark: Color.white, light: Color.white, hc: Color.white }, localize('buttonForeground', 'Button foreground color.'));
export const buttonBackground = registerColor('button.background', { dark: '#0E639C', light: '#007ACC', hc: null }, localize('buttonBackground', 'Button background color.'));
export const buttonHoverBackground = registerColor('button.hoverBackground', { dark: lighten(buttonBackground, 0.2), light: darken(buttonBackground, 0.2), hc: null }, localize('buttonHoverBackground', 'Button background color when hovering.'));

export const badgeBackground = registerColor('badge.background', { dark: '#4D4D4D', light: '#C4C4C4', hc: Color.black }, localize('badgeBackground', 'Badge background color. Badges are small information labels, e.g. for search results count.'));
export const badgeForeground = registerColor('badge.foreground', { dark: Color.white, light: '#333', hc: Color.white }, localize('badgeForeground', 'Badge foreground color. Badges are small information labels, e.g. for search results count.'));

export const scrollbarShadow = registerColor('scrollbar.shadow', { dark: '#000000', light: '#DDDDDD', hc: null }, localize('scrollbarShadow', 'Scrollbar shadow to indicate that the view is scrolled.'));
export const scrollbarSliderBackground = registerColor('scrollbarSlider.background', { dark: Color.fromHex('#797979').transparent(0.4), light: Color.fromHex('#646464').transparent(0.4), hc: transparent(contrastBorder, 0.6) }, localize('scrollbarSliderBackground', 'Scrollbar slider background color.'));
export const scrollbarSliderHoverBackground = registerColor('scrollbarSlider.hoverBackground', { dark: Color.fromHex('#646464').transparent(0.7), light: Color.fromHex('#646464').transparent(0.7), hc: transparent(contrastBorder, 0.8) }, localize('scrollbarSliderHoverBackground', 'Scrollbar slider background color when hovering.'));
export const scrollbarSliderActiveBackground = registerColor('scrollbarSlider.activeBackground', { dark: Color.fromHex('#BFBFBF').transparent(0.4), light: Color.fromHex('#000000').transparent(0.6), hc: contrastBorder }, localize('scrollbarSliderActiveBackground', 'Scrollbar slider background color when clicked on.'));

export const progressBarBackground = registerColor('progressBar.background', { dark: Color.fromHex('#0E70C0'), light: Color.fromHex('#0E70C0'), hc: contrastBorder }, localize('progressBarBackground', 'Background color of the progress bar that can show for long running operations.'));

export const menuBorder = registerColor('menu.border', { dark: null, light: null, hc: contrastBorder }, localize('menuBorder', 'Border color of menus.'));
export const menuForeground = registerColor('menu.foreground', { dark: selectForeground, light: foreground, hc: selectForeground }, localize('menuForeground', 'Foreground color of menu items.'));
export const menuBackground = registerColor('menu.background', { dark: selectBackground, light: selectBackground, hc: selectBackground }, localize('menuBackground', 'Background color of menu items.'));
export const menuSelectionForeground = registerColor('menu.selectionForeground', { dark: listActiveSelectionForeground, light: listActiveSelectionForeground, hc: listActiveSelectionForeground }, localize('menuSelectionForeground', 'Foreground color of the selected menu item in menus.'));
export const menuSelectionBackground = registerColor('menu.selectionBackground', { dark: listActiveSelectionBackground, light: listActiveSelectionBackground, hc: listActiveSelectionBackground }, localize('menuSelectionBackground', 'Background color of the selected menu item in menus.'));
export const menuSelectionBorder = registerColor('menu.selectionBorder', { dark: null, light: null, hc: activeContrastBorder }, localize('menuSelectionBorder', 'Border color of the selected menu item in menus.'));
export const menuSeparatorBackground = registerColor('menu.separatorBackground', { dark: '#BBBBBB', light: '#888888', hc: contrastBorder }, localize('menuSeparatorBackground', 'Color of a separator menu item in menus.'));

export const editorErrorForeground = registerColor('editorError.foreground', { dark: '#F48771', light: '#E51400', hc: null }, localize('editorError.foreground', 'Foreground color of error squigglies in the editor.'));
export const editorErrorBorder = registerColor('editorError.border', { dark: null, light: null, hc: Color.fromHex('#E47777').transparent(0.8) }, localize('errorBorder', 'Border color of error boxes in the editor.'));

export const editorWarningForeground = registerColor('editorWarning.foreground', { dark: '#CCA700', light: '#E9A700', hc: null }, localize('editorWarning.foreground', 'Foreground color of warning squigglies in the editor.'));
export const editorWarningBorder = registerColor('editorWarning.border', { dark: null, light: null, hc: Color.fromHex('#FFCC00').transparent(0.8) }, localize('warningBorder', 'Border color of warning boxes in the editor.'));

export const editorInfoForeground = registerColor('editorInfo.foreground', { dark: '#008000', light: '#008000', hc: null }, localize('editorInfo.foreground', 'Foreground color of info squigglies in the editor.'));
export const editorInfoBorder = registerColor('editorInfo.border', { dark: null, light: null, hc: Color.fromHex('#71B771').transparent(0.8) }, localize('infoBorder', 'Border color of info boxes in the editor.'));

export const editorHintForeground = registerColor('editorHint.foreground', { dark: Color.fromHex('#eeeeee').transparent(0.7), light: '#6c6c6c', hc: null }, localize('editorHint.foreground', 'Foreground color of hint squigglies in the editor.'));
export const editorHintBorder = registerColor('editorHint.border', { dark: null, light: null, hc: Color.fromHex('#eeeeee').transparent(0.8) }, localize('hintBorder', 'Border color of hint boxes in the editor.'));

/**
 * Editor background color.
 * Because of bug https://monacotools.visualstudio.com/DefaultCollection/Monaco/_workitems/edit/13254
 * we are *not* using the color white (or #ffffff, rgba(255,255,255)) but something very close to white.
 */
export const editorBackground = registerColor('editor.background', { light: '#fffffe', dark: '#1E1E1E', hc: Color.black }, localize('editorBackground', 'Editor background color.'));

/**
 * Editor foreground color.
 */
export const editorForeground = registerColor('editor.foreground', { light: '#333333', dark: '#BBBBBB', hc: Color.white }, localize('editorForeground', 'Editor default foreground color.'));

/**
 * Editor widgets
 */
export const editorWidgetBackground = registerColor('editorWidget.background', { dark: '#252526', light: '#F3F3F3', hc: '#0C141F' }, localize('editorWidgetBackground', 'Background color of editor widgets, such as find/replace.'));
export const editorWidgetBorder = registerColor('editorWidget.border', { dark: '#454545', light: '#C8C8C8', hc: contrastBorder }, localize('editorWidgetBorder', 'Border color of editor widgets. The color is only used if the widget chooses to have a border and if the color is not overridden by a widget.'));

export const editorWidgetResizeBorder = registerColor('editorWidget.resizeBorder', { light: null, dark: null, hc: null }, localize('editorWidgetResizeBorder', 'Border color of the resize bar of editor widgets. The color is only used if the widget chooses to have a resize border and if the color is not overridden by a widget.'));

/**
 * Editor selection colors.
 */
export const editorSelectionBackground = registerColor('editor.selectionBackground', { light: '#ADD6FF', dark: '#264F78', hc: '#f3f518' }, localize('editorSelectionBackground', 'Color of the editor selection.'));
export const editorSelectionForeground = registerColor('editor.selectionForeground', { light: null, dark: null, hc: '#000000' }, localize('editorSelectionForeground', 'Color of the selected text for high contrast.'));
export const editorInactiveSelection = registerColor('editor.inactiveSelectionBackground', { light: transparent(editorSelectionBackground, 0.5), dark: transparent(editorSelectionBackground, 0.5), hc: transparent(editorSelectionBackground, 0.5) }, localize('editorInactiveSelection', 'Color of the selection in an inactive editor. The color must not be opaque so as not to hide underlying decorations.'), true);
export const editorSelectionHighlight = registerColor('editor.selectionHighlightBackground', { light: lessProminent(editorSelectionBackground, editorBackground, 0.3, 0.6), dark: lessProminent(editorSelectionBackground, editorBackground, 0.3, 0.6), hc: null }, localize('editorSelectionHighlight', 'Color for regions with the same content as the selection. The color must not be opaque so as not to hide underlying decorations.'), true);
export const editorSelectionHighlightBorder = registerColor('editor.selectionHighlightBorder', { light: null, dark: null, hc: activeContrastBorder }, localize('editorSelectionHighlightBorder', 'Border color for regions with the same content as the selection.'));

/**
 * Editor find match colors.
 */
export const editorFindMatch = registerColor('editor.findMatchBackground', { light: '#A8AC94', dark: '#515C6A', hc: null }, localize('editorFindMatch', 'Color of the current search match.'));
export const editorFindMatchHighlight = registerColor('editor.findMatchHighlightBackground', { light: '#EA5C0055', dark: '#EA5C0055', hc: null }, localize('findMatchHighlight', 'Color of the other search matches. The color must not be opaque so as not to hide underlying decorations.'), true);
export const editorFindRangeHighlight = registerColor('editor.findRangeHighlightBackground', { dark: '#3a3d4166', light: '#b4b4b44d', hc: null }, localize('findRangeHighlight', 'Color of the range limiting the search. The color must not be opaque so as not to hide underlying decorations.'), true);
export const editorFindMatchBorder = registerColor('editor.findMatchBorder', { light: null, dark: null, hc: activeContrastBorder }, localize('editorFindMatchBorder', 'Border color of the current search match.'));
export const editorFindMatchHighlightBorder = registerColor('editor.findMatchHighlightBorder', { light: null, dark: null, hc: activeContrastBorder }, localize('findMatchHighlightBorder', 'Border color of the other search matches.'));
export const editorFindRangeHighlightBorder = registerColor('editor.findRangeHighlightBorder', { dark: null, light: null, hc: transparent(activeContrastBorder, 0.4) }, localize('findRangeHighlightBorder', 'Border color of the range limiting the search. The color must not be opaque so as not to hide underlying decorations.'), true);

/**
 * Editor hover
 */
export const editorHoverHighlight = registerColor('editor.hoverHighlightBackground', { light: '#ADD6FF26', dark: '#264f7840', hc: '#ADD6FF26' }, localize('hoverHighlight', 'Highlight below the word for which a hover is shown. The color must not be opaque so as not to hide underlying decorations.'), true);
export const editorHoverBackground = registerColor('editorHoverWidget.background', { light: editorWidgetBackground, dark: editorWidgetBackground, hc: editorWidgetBackground }, localize('hoverBackground', 'Background color of the editor hover.'));
export const editorHoverBorder = registerColor('editorHoverWidget.border', { light: editorWidgetBorder, dark: editorWidgetBorder, hc: editorWidgetBorder }, localize('hoverBorder', 'Border color of the editor hover.'));
export const editorHoverStatusBarBackground = registerColor('editorHoverWidget.statusBarBackground', { dark: lighten(editorHoverBackground, 0.2), light: darken(editorHoverBackground, 0.05), hc: editorWidgetBackground }, localize('statusBarBackground', 'Background color of the editor hover status bar.'));

/**
 * Editor link colors
 */
export const editorActiveLinkForeground = registerColor('editorLink.activeForeground', { dark: '#4E94CE', light: Color.blue, hc: Color.cyan }, localize('activeLinkForeground', 'Color of active links.'));

/**
 * Diff Editor Colors
 */
export const defaultInsertColor = new Color(new RGBA(155, 185, 85, 0.2));
export const defaultRemoveColor = new Color(new RGBA(255, 0, 0, 0.2));

export const diffInserted = registerColor('diffEditor.insertedTextBackground', { dark: defaultInsertColor, light: defaultInsertColor, hc: null }, localize('diffEditorInserted', 'Background color for text that got inserted. The color must not be opaque so as not to hide underlying decorations.'), true);
export const diffRemoved = registerColor('diffEditor.removedTextBackground', { dark: defaultRemoveColor, light: defaultRemoveColor, hc: null }, localize('diffEditorRemoved', 'Background color for text that got removed. The color must not be opaque so as not to hide underlying decorations.'), true);

export const diffInsertedOutline = registerColor('diffEditor.insertedTextBorder', { dark: null, light: null, hc: '#33ff2eff' }, localize('diffEditorInsertedOutline', 'Outline color for the text that got inserted.'));
export const diffRemovedOutline = registerColor('diffEditor.removedTextBorder', { dark: null, light: null, hc: '#FF008F' }, localize('diffEditorRemovedOutline', 'Outline color for text that got removed.'));

export const diffBorder = registerColor('diffEditor.border', { dark: null, light: null, hc: contrastBorder }, localize('diffEditorBorder', 'Border color between the two text editors.'));

/**
 * Editor View Colors from editorColorRegistry
 */
export const editorLineHighlight = registerColor('editor.lineHighlightBackground', { dark: null, light: null, hc: null }, localize('lineHighlight', 'Background color for the highlight of line at the cursor position.'));
export const editorLineHighlightBorder = registerColor('editor.lineHighlightBorder', { dark: '#282828', light: '#eeeeee', hc: '#f38518' }, localize('lineHighlightBorderBox', 'Background color for the border around the line at the cursor position.'));
export const editorRangeHighlight = registerColor('editor.rangeHighlightBackground', { dark: '#ffffff0b', light: '#fdff0033', hc: null }, localize('rangeHighlight', 'Background color of highlighted ranges, like by quick open and find features. The color must not be opaque so as not to hide underlying decorations.'), true);
export const editorRangeHighlightBorder = registerColor('editor.rangeHighlightBorder', { dark: null, light: null, hc: activeContrastBorder }, localize('rangeHighlightBorder', 'Background color of the border around highlighted ranges.'), true);

export const editorCursorForeground = registerColor('editorCursor.foreground', { dark: '#AEAFAD', light: Color.black, hc: Color.white }, localize('caret', 'Color of the editor cursor.'));
export const editorCursorBackground = registerColor('editorCursor.background', null, localize('editorCursorBackground', 'The background color of the editor cursor. Allows customizing the color of a character overlapped by a block cursor.'));
export const editorWhitespaces = registerColor('editorWhitespace.foreground', { dark: '#e3e4e229', light: '#33333333', hc: '#e3e4e229' }, localize('editorWhitespaces', 'Color of whitespace characters in the editor.'));
export const editorIndentGuides = registerColor('editorIndentGuide.background', { dark: editorWhitespaces, light: editorWhitespaces, hc: editorWhitespaces }, localize('editorIndentGuides', 'Color of the editor indentation guides.'));
export const editorActiveIndentGuides = registerColor('editorIndentGuide.activeBackground', { dark: editorWhitespaces, light: editorWhitespaces, hc: editorWhitespaces }, localize('editorActiveIndentGuide', 'Color of the active editor indentation guides.'));
export const editorLineNumbers = registerColor('editorLineNumber.foreground', { dark: '#858585', light: '#237893', hc: Color.white }, localize('editorLineNumbers', 'Color of editor line numbers.'));

const deprecatedEditorActiveLineNumber = registerColor('editorActiveLineNumber.foreground', { dark: '#c6c6c6', light: '#0B216F', hc: activeContrastBorder }, localize('editorActiveLineNumber', 'Color of editor active line number'), false, localize('deprecatedEditorActiveLineNumber', 'Id is deprecated. Use \'editorLineNumber.activeForeground\' instead.'));
export const editorActiveLineNumber = registerColor('editorLineNumber.activeForeground', { dark: deprecatedEditorActiveLineNumber, light: deprecatedEditorActiveLineNumber, hc: deprecatedEditorActiveLineNumber }, localize('editorActiveLineNumber', 'Color of editor active line number'));

export const editorRuler = registerColor('editorRuler.foreground', { dark: '#5A5A5A', light: Color.lightgrey, hc: Color.white }, localize('editorRuler', 'Color of the editor rulers.'));

export const editorCodeLensForeground = registerColor('editorCodeLens.foreground', { dark: '#999999', light: '#999999', hc: '#999999' }, localize('editorCodeLensForeground', 'Foreground color of editor code lenses'));

export const editorBracketMatchBackground = registerColor('editorBracketMatch.background', { dark: '#0064001a', light: '#0064001a', hc: '#0064001a' }, localize('editorBracketMatchBackground', 'Background color behind matching brackets'));
export const editorBracketMatchBorder = registerColor('editorBracketMatch.border', { dark: '#888', light: '#B9B9B9', hc: '#fff' }, localize('editorBracketMatchBorder', 'Color for matching brackets boxes'));

export const editorOverviewRulerBorder = registerColor('editorOverviewRuler.border', { dark: '#7f7f7f4d', light: '#7f7f7f4d', hc: '#7f7f7f4d' }, localize('editorOverviewRulerBorder', 'Color of the overview ruler border.'));

export const editorGutter = registerColor('editorGutter.background', { dark: editorBackground, light: editorBackground, hc: editorBackground }, localize('editorGutter', 'Background color of the editor gutter. The gutter contains the glyph margins and the line numbers.'));

export const editorUnnecessaryCodeBorder = registerColor('editorUnnecessaryCode.border', { dark: null, light: null, hc: Color.fromHex('#fff').transparent(0.8) }, localize('unnecessaryCodeBorder', 'Border color of unnecessary (unused) source code in the editor.'));
export const editorUnnecessaryCodeOpacity = registerColor('editorUnnecessaryCode.opacity', { dark: Color.fromHex('#000a'), light: Color.fromHex('#0007'), hc: null }, localize('unnecessaryCodeOpacity', 'Opacity of unnecessary (unused) source code in the editor. For example, "#000000c0" will render the code with 75% opacity. For high contrast themes, use the  \'editorUnnecessaryCode.border\' theme color to underline unnecessary code instead of fading it out.'));

const rulerRangeDefault = new Color(new RGBA(0, 122, 204, 0.6));
export const overviewRulerRangeHighlight = registerColor('editorOverviewRuler.rangeHighlightForeground', { dark: rulerRangeDefault, light: rulerRangeDefault, hc: rulerRangeDefault }, localize('overviewRulerRangeHighlight', 'Overview ruler marker color for range highlights. The color must not be opaque so as not to hide underlying decorations.'), true);
export const overviewRulerError = registerColor('editorOverviewRuler.errorForeground', { dark: new Color(new RGBA(255, 18, 18, 0.7)), light: new Color(new RGBA(255, 18, 18, 0.7)), hc: new Color(new RGBA(255, 50, 50, 1)) }, localize('overviewRuleError', 'Overview ruler marker color for errors.'));
export const overviewRulerWarning = registerColor('editorOverviewRuler.warningForeground', { dark: editorWarningForeground, light: editorWarningForeground, hc: editorWarningBorder }, localize('overviewRuleWarning', 'Overview ruler marker color for warnings.'));
export const overviewRulerInfo = registerColor('editorOverviewRuler.infoForeground', { dark: editorInfoForeground, light: editorInfoForeground, hc: editorInfoBorder }, localize('overviewRuleInfo', 'Overview ruler marker color for infos.'));

/**
 * Snippet placeholder colors
 */
export const snippetTabstopHighlightBackground = registerColor('editor.snippetTabstopHighlightBackground', { dark: new Color(new RGBA(124, 124, 124, 0.3)), light: new Color(new RGBA(10, 50, 100, 0.2)), hc: new Color(new RGBA(124, 124, 124, 0.3)) }, localize('snippetTabstopHighlightBackground', 'Highlight background color of a snippet tabstop.'));
export const snippetTabstopHighlightBorder = registerColor('editor.snippetTabstopHighlightBorder', { dark: null, light: null, hc: null }, localize('snippetTabstopHighlightBorder', 'Highlight border color of a snippet tabstop.'));
export const snippetFinalTabstopHighlightBackground = registerColor('editor.snippetFinalTabstopHighlightBackground', { dark: null, light: null, hc: null }, localize('snippetFinalTabstopHighlightBackground', 'Highlight background color of the final tabstop of a snippet.'));
export const snippetFinalTabstopHighlightBorder = registerColor('editor.snippetFinalTabstopHighlightBorder', { dark: '#525252', light: new Color(new RGBA(10, 50, 100, 0.5)), hc: '#525252' }, localize('snippetFinalTabstopHighlightBorder', 'Highlight border color of the final stabstop of a snippet.'));

/**
 * Breadcrumb colors
 */
export const breadcrumbsForeground = registerColor('breadcrumb.foreground', { light: transparent(foreground, 0.8), dark: transparent(foreground, 0.8), hc: transparent(foreground, 0.8) }, localize('breadcrumbsFocusForeground', 'Color of focused breadcrumb items.'));
export const breadcrumbsBackground = registerColor('breadcrumb.background', { light: editorBackground, dark: editorBackground, hc: editorBackground }, localize('breadcrumbsBackground', 'Background color of breadcrumb items.'));
export const breadcrumbsFocusForeground = registerColor('breadcrumb.focusForeground', { light: darken(foreground, 0.2), dark: lighten(foreground, 0.1), hc: lighten(foreground, 0.1) }, localize('breadcrumbsFocusForeground', 'Color of focused breadcrumb items.'));
export const breadcrumbsActiveSelectionForeground = registerColor('breadcrumb.activeSelectionForeground', { light: darken(foreground, 0.2), dark: lighten(foreground, 0.1), hc: lighten(foreground, 0.1) }, localize('breadcrumbsSelectedForegound', 'Color of selected breadcrumb items.'));
export const breadcrumbsPickerBackground = registerColor('breadcrumbPicker.background', { light: editorWidgetBackground, dark: editorWidgetBackground, hc: editorWidgetBackground }, localize('breadcrumbsSelectedBackground', 'Background color of breadcrumb item picker.'));

/**
 * Merge-conflict colors
 */

const headerTransparency = 0.5;
const currentBaseColor = Color.fromHex('#40C8AE').transparent(headerTransparency);
const incomingBaseColor = Color.fromHex('#40A6FF').transparent(headerTransparency);
const commonBaseColor = Color.fromHex('#606060').transparent(0.4);
const contentTransparency = 0.4;
const rulerTransparency = 1;

export const mergeCurrentHeaderBackground = registerColor('merge.currentHeaderBackground', { dark: currentBaseColor, light: currentBaseColor, hc: null }, localize('mergeCurrentHeaderBackground', 'Current header background in inline merge-conflicts. The color must not be opaque so as not to hide underlying decorations.'), true);
export const mergeCurrentContentBackground = registerColor('merge.currentContentBackground', { dark: transparent(mergeCurrentHeaderBackground, contentTransparency), light: transparent(mergeCurrentHeaderBackground, contentTransparency), hc: transparent(mergeCurrentHeaderBackground, contentTransparency) }, localize('mergeCurrentContentBackground', 'Current content background in inline merge-conflicts. The color must not be opaque so as not to hide underlying decorations.'), true);
export const mergeIncomingHeaderBackground = registerColor('merge.incomingHeaderBackground', { dark: incomingBaseColor, light: incomingBaseColor, hc: null }, localize('mergeIncomingHeaderBackground', 'Incoming header background in inline merge-conflicts. The color must not be opaque so as not to hide underlying decorations.'), true);
export const mergeIncomingContentBackground = registerColor('merge.incomingContentBackground', { dark: transparent(mergeIncomingHeaderBackground, contentTransparency), light: transparent(mergeIncomingHeaderBackground, contentTransparency), hc: transparent(mergeIncomingHeaderBackground, contentTransparency) }, localize('mergeIncomingContentBackground', 'Incoming content background in inline merge-conflicts. The color must not be opaque so as not to hide underlying decorations.'), true);
export const mergeCommonHeaderBackground = registerColor('merge.commonHeaderBackground', { dark: commonBaseColor, light: commonBaseColor, hc: null }, localize('mergeCommonHeaderBackground', 'Common ancestor header background in inline merge-conflicts. The color must not be opaque so as not to hide underlying decorations.'), true);
export const mergeCommonContentBackground = registerColor('merge.commonContentBackground', { dark: transparent(mergeCommonHeaderBackground, contentTransparency), light: transparent(mergeCommonHeaderBackground, contentTransparency), hc: transparent(mergeCommonHeaderBackground, contentTransparency) }, localize('mergeCommonContentBackground', 'Common ancestor content background in inline merge-conflicts. The color must not be opaque so as not to hide underlying decorations.'), true);

export const mergeBorder = registerColor('merge.border', { dark: null, light: null, hc: '#C3DF6F' }, localize('mergeBorder', 'Border color on headers and the splitter in inline merge-conflicts.'));

export const overviewRulerCurrentContentForeground = registerColor('editorOverviewRuler.currentContentForeground', { dark: transparent(mergeCurrentHeaderBackground, rulerTransparency), light: transparent(mergeCurrentHeaderBackground, rulerTransparency), hc: mergeBorder }, localize('overviewRulerCurrentContentForeground', 'Current overview ruler foreground for inline merge-conflicts.'));
export const overviewRulerIncomingContentForeground = registerColor('editorOverviewRuler.incomingContentForeground', { dark: transparent(mergeIncomingHeaderBackground, rulerTransparency), light: transparent(mergeIncomingHeaderBackground, rulerTransparency), hc: mergeBorder }, localize('overviewRulerIncomingContentForeground', 'Incoming overview ruler foreground for inline merge-conflicts.'));
export const overviewRulerCommonContentForeground = registerColor('editorOverviewRuler.commonContentForeground', { dark: transparent(mergeCommonHeaderBackground, rulerTransparency), light: transparent(mergeCommonHeaderBackground, rulerTransparency), hc: mergeBorder }, localize('overviewRulerCommonContentForeground', 'Common ancestor overview ruler foreground for inline merge-conflicts.'));

export const overviewRulerFindMatchForeground = registerColor('editorOverviewRuler.findMatchForeground', { dark: '#d186167e', light: '#d186167e', hc: '#AB5A00' }, localize('overviewRulerFindMatchForeground', 'Overview ruler marker color for find matches. The color must not be opaque so as not to hide underlying decorations.'), true);

export const overviewRulerSelectionHighlightForeground = registerColor('editorOverviewRuler.selectionHighlightForeground', { dark: '#A0A0A0CC', light: '#A0A0A0CC', hc: '#A0A0A0CC' }, localize('overviewRulerSelectionHighlightForeground', 'Overview ruler marker color for selection highlights. The color must not be opaque so as not to hide underlying decorations.'), true);

// < --- Workbench (not customizable) --- >

export function WORKBENCH_BACKGROUND(theme: ITheme): Color {
  switch (theme.type) {
    case 'dark':
      return Color.fromHex('#252526');
    case 'light':
      return Color.fromHex('#F3F3F3');
    default:
      return Color.fromHex('#000000');
  }
}

// < --- Tabs --- >

export const TAB_ACTIVE_BACKGROUND = registerColor('tab.activeBackground', {
  dark: editorBackground,
  light: editorBackground,
  hc: editorBackground,
}, localize('tabActiveBackground', 'Active tab background color. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.'));

export const TAB_UNFOCUSED_ACTIVE_BACKGROUND = registerColor('tab.unfocusedActiveBackground', {
  dark: TAB_ACTIVE_BACKGROUND,
  light: TAB_ACTIVE_BACKGROUND,
  hc: TAB_ACTIVE_BACKGROUND,
}, localize('tabUnfocusedActiveBackground', 'Active tab background color in an unfocused group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.'));

export const TAB_INACTIVE_BACKGROUND = registerColor('tab.inactiveBackground', {
  dark: '#2D2D2D',
  light: '#ECECEC',
  hc: null,
}, localize('tabInactiveBackground', 'Inactive tab background color. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.'));

export const TAB_HOVER_BACKGROUND = registerColor('tab.hoverBackground', {
  dark: null,
  light: null,
  hc: null,
}, localize('tabHoverBackground', 'Tab background color when hovering. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.'));

export const TAB_UNFOCUSED_HOVER_BACKGROUND = registerColor('tab.unfocusedHoverBackground', {
  dark: transparent(TAB_HOVER_BACKGROUND, 0.5),
  light: transparent(TAB_HOVER_BACKGROUND, 0.7),
  hc: null,
}, localize('tabUnfocusedHoverBackground', 'Tab background color in an unfocused group when hovering. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.'));

export const TAB_BORDER = registerColor('tab.border', {
  dark: '#252526',
  light: '#F3F3F3',
  hc: contrastBorder,
}, localize('tabBorder', 'Border to separate tabs from each other. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.'));

export const TAB_ACTIVE_BORDER = registerColor('tab.activeBorder', {
  dark: null,
  light: null,
  hc: null,
}, localize('tabActiveBorder', 'Border on the bottom of an active tab. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.'));

export const TAB_UNFOCUSED_ACTIVE_BORDER = registerColor('tab.unfocusedActiveBorder', {
  dark: transparent(TAB_ACTIVE_BORDER, 0.5),
  light: transparent(TAB_ACTIVE_BORDER, 0.7),
  hc: null,
}, localize('tabActiveUnfocusedBorder', 'Border on the bottom of an active tab in an unfocused group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.'));

export const TAB_ACTIVE_BORDER_TOP = registerColor('tab.activeBorderTop', {
  dark: null,
  light: null,
  hc: null,
}, localize('tabActiveBorderTop', 'Border to the top of an active tab. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.'));

export const TAB_UNFOCUSED_ACTIVE_BORDER_TOP = registerColor('tab.unfocusedActiveBorderTop', {
  dark: transparent(TAB_ACTIVE_BORDER_TOP, 0.5),
  light: transparent(TAB_ACTIVE_BORDER_TOP, 0.7),
  hc: null,
}, localize('tabActiveUnfocusedBorderTop', 'Border to the top of an active tab in an unfocused group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.'));

export const TAB_ACTIVE_MODIFIED_BORDER = registerColor('tab.activeModifiedBorder', {
  dark: '#3399CC',
  light: '#33AAEE',
  hc: null,
}, localize('tabActiveModifiedBorder', 'Border on the top of modified (dirty) active tabs in an active group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.'));

export const TAB_INACTIVE_MODIFIED_BORDER = registerColor('tab.inactiveModifiedBorder', {
  dark: transparent(TAB_ACTIVE_MODIFIED_BORDER, 0.5),
  light: transparent(TAB_ACTIVE_MODIFIED_BORDER, 0.5),
  hc: Color.white,
}, localize('tabInactiveModifiedBorder', 'Border on the top of modified (dirty) inactive tabs in an active group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.'));

export const TAB_UNFOCUSED_ACTIVE_MODIFIED_BORDER = registerColor('tab.unfocusedActiveModifiedBorder', {
  dark: transparent(TAB_ACTIVE_MODIFIED_BORDER, 0.5),
  light: transparent(TAB_ACTIVE_MODIFIED_BORDER, 0.7),
  hc: Color.white,
}, localize('unfocusedActiveModifiedBorder', 'Border on the top of modified (dirty) active tabs in an unfocused group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.'));

export const TAB_UNFOCUSED_INACTIVE_MODIFIED_BORDER = registerColor('tab.unfocusedInactiveModifiedBorder', {
  dark: transparent(TAB_INACTIVE_MODIFIED_BORDER, 0.5),
  light: transparent(TAB_INACTIVE_MODIFIED_BORDER, 0.5),
  hc: Color.white,
}, localize('unfocusedINactiveModifiedBorder', 'Border on the top of modified (dirty) inactive tabs in an unfocused group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.'));

export const TAB_HOVER_BORDER = registerColor('tab.hoverBorder', {
  dark: null,
  light: null,
  hc: null,
}, localize('tabHoverBorder', 'Border to highlight tabs when hovering. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.'));

export const TAB_UNFOCUSED_HOVER_BORDER = registerColor('tab.unfocusedHoverBorder', {
  dark: transparent(TAB_HOVER_BORDER, 0.5),
  light: transparent(TAB_HOVER_BORDER, 0.7),
  hc: null,
}, localize('tabUnfocusedHoverBorder', 'Border to highlight tabs in an unfocused group when hovering. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.'));

export const TAB_ACTIVE_FOREGROUND = registerColor('tab.activeForeground', {
  dark: Color.white,
  light: '#333333',
  hc: Color.white,
}, localize('tabActiveForeground', 'Active tab foreground color in an active group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.'));

export const TAB_INACTIVE_FOREGROUND = registerColor('tab.inactiveForeground', {
  dark: transparent(TAB_ACTIVE_FOREGROUND, 0.5),
  light: transparent(TAB_ACTIVE_FOREGROUND, 0.7),
  hc: Color.white,
}, localize('tabInactiveForeground', 'Inactive tab foreground color in an active group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.'));

export const TAB_UNFOCUSED_ACTIVE_FOREGROUND = registerColor('tab.unfocusedActiveForeground', {
  dark: transparent(TAB_ACTIVE_FOREGROUND, 0.5),
  light: transparent(TAB_ACTIVE_FOREGROUND, 0.7),
  hc: Color.white,
}, localize('tabUnfocusedActiveForeground', 'Active tab foreground color in an unfocused group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.'));

export const TAB_UNFOCUSED_INACTIVE_FOREGROUND = registerColor('tab.unfocusedInactiveForeground', {
  dark: transparent(TAB_INACTIVE_FOREGROUND, 0.5),
  light: transparent(TAB_INACTIVE_FOREGROUND, 0.5),
  hc: Color.white,
}, localize('tabUnfocusedInactiveForeground', 'Inactive tab foreground color in an unfocused group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.'));

// < --- Editors --- >

export const EDITOR_PANE_BACKGROUND = registerColor('editorPane.background', {
  dark: editorBackground,
  light: editorBackground,
  hc: editorBackground,
}, localize('editorPaneBackground', 'Background color of the editor pane visible on the left and right side of the centered editor layout.'));

registerColor('editorGroup.background', {
  dark: null,
  light: null,
  hc: null,
}, localize('editorGroupBackground', 'Deprecated background color of an editor group.'), false, localize('deprecatedEditorGroupBackground', 'Deprecated: Background color of an editor group is no longer being supported with the introduction of the grid editor layout. You can use editorGroup.emptyBackground to set the background color of empty editor groups.'));

export const EDITOR_GROUP_EMPTY_BACKGROUND = registerColor('editorGroup.emptyBackground', {
  dark: null,
  light: null,
  hc: null,
}, localize('editorGroupEmptyBackground', 'Background color of an empty editor group. Editor groups are the containers of editors.'));

export const EDITOR_GROUP_FOCUSED_EMPTY_BORDER = registerColor('editorGroup.focusedEmptyBorder', {
  dark: null,
  light: null,
  hc: focusBorder,
}, localize('editorGroupFocusedEmptyBorder', 'Border color of an empty editor group that is focused. Editor groups are the containers of editors.'));

export const EDITOR_GROUP_HEADER_TABS_BACKGROUND = registerColor('editorGroupHeader.tabsBackground', {
  dark: '#252526',
  light: '#F3F3F3',
  hc: null,
}, localize('tabsContainerBackground', 'Background color of the editor group title header when tabs are enabled. Editor groups are the containers of editors.'));

export const EDITOR_GROUP_HEADER_TABS_BORDER = registerColor('editorGroupHeader.tabsBorder', {
  dark: null,
  light: null,
  hc: contrastBorder,
}, localize('tabsContainerBorder', 'Border color of the editor group title header when tabs are enabled. Editor groups are the containers of editors.'));

export const EDITOR_GROUP_HEADER_NO_TABS_BACKGROUND = registerColor('editorGroupHeader.noTabsBackground', {
  dark: editorBackground,
  light: editorBackground,
  hc: editorBackground,
}, localize('editorGroupHeaderBackground', 'Background color of the editor group title header when tabs are disabled (`"workbench.editor.showTabs": false`). Editor groups are the containers of editors.'));

export const EDITOR_GROUP_BORDER = registerColor('editorGroup.border', {
  dark: '#444444',
  light: '#E7E7E7',
  hc: contrastBorder,
}, localize('editorGroupBorder', 'Color to separate multiple editor groups from each other. Editor groups are the containers of editors.'));

export const EDITOR_DRAG_AND_DROP_BACKGROUND = registerColor('editorGroup.dropBackground', {
  dark: Color.fromHex('#53595D').transparent(0.5),
  light: Color.fromHex('#2677CB').transparent(0.18),
  hc: null,
}, localize('editorDragAndDropBackground', 'Background color when dragging editors around. The color should have transparency so that the editor contents can still shine through.'));

// < --- Panels --- >

export const PANEL_BACKGROUND = registerColor('panel.background', {
  dark: editorBackground,
  light: editorBackground,
  hc: editorBackground,
}, localize('panelBackground', 'Panel background color. Panels are shown below the editor area and contain views like output and integrated terminal.'));

export const PANEL_BORDER = registerColor('panel.border', {
  dark: Color.fromHex('#808080').transparent(0.35),
  light: Color.fromHex('#808080').transparent(0.35),
  hc: contrastBorder,
}, localize('panelBorder', 'Panel border color to separate the panel from the editor. Panels are shown below the editor area and contain views like output and integrated terminal.'));

export const PANEL_ACTIVE_TITLE_FOREGROUND = registerColor('panelTitle.activeForeground', {
  dark: '#E7E7E7',
  light: '#424242',
  hc: Color.white,
}, localize('panelActiveTitleForeground', 'Title color for the active panel. Panels are shown below the editor area and contain views like output and integrated terminal.'));

export const PANEL_INACTIVE_TITLE_FOREGROUND = registerColor('panelTitle.inactiveForeground', {
  dark: transparent(PANEL_ACTIVE_TITLE_FOREGROUND, 0.6),
  light: transparent(PANEL_ACTIVE_TITLE_FOREGROUND, 0.75),
  hc: Color.white,
}, localize('panelInactiveTitleForeground', 'Title color for the inactive panel. Panels are shown below the editor area and contain views like output and integrated terminal.'));

export const PANEL_ACTIVE_TITLE_BORDER = registerColor('panelTitle.activeBorder', {
  dark: PANEL_BORDER,
  light: PANEL_BORDER,
  hc: contrastBorder,
}, localize('panelActiveTitleBorder', 'Border color for the active panel title. Panels are shown below the editor area and contain views like output and integrated terminal.'));

export const PANEL_DRAG_AND_DROP_BACKGROUND = registerColor('panel.dropBackground', {
  dark: Color.white.transparent(0.12),
  light: Color.fromHex('#2677CB').transparent(0.18),
  hc: Color.white.transparent(0.12),
}, localize('panelDragAndDropBackground', 'Drag and drop feedback color for the panel title items. The color should have transparency so that the panel entries can still shine through. Panels are shown below the editor area and contain views like output and integrated terminal.'));

export const PANEL_INPUT_BORDER = registerColor('panelInput.border', {
  dark: null,
  light: Color.fromHex('#ddd'),
  hc: null,
}, localize('panelInputBorder', 'Input box border for inputs in the panel.'));

// < --- Status --- >

export const STATUS_BAR_FOREGROUND = registerColor('statusBar.foreground', {
  dark: '#FFFFFF',
  light: '#FFFFFF',
  hc: '#FFFFFF',
}, localize('statusBarForeground', 'Status bar foreground color when a workspace is opened. The status bar is shown in the bottom of the window.'));

export const STATUS_BAR_NO_FOLDER_FOREGROUND = registerColor('statusBar.noFolderForeground', {
  dark: STATUS_BAR_FOREGROUND,
  light: STATUS_BAR_FOREGROUND,
  hc: STATUS_BAR_FOREGROUND,
}, localize('statusBarNoFolderForeground', 'Status bar foreground color when no folder is opened. The status bar is shown in the bottom of the window.'));

export const STATUS_BAR_BACKGROUND = registerColor('statusBar.background', {
  dark: '#007ACC',
  light: '#007ACC',
  hc: null,
}, localize('statusBarBackground', 'Status bar background color when a workspace is opened. The status bar is shown in the bottom of the window.'));

export const STATUS_BAR_NO_FOLDER_BACKGROUND = registerColor('statusBar.noFolderBackground', {
  dark: '#68217A',
  light: '#68217A',
  hc: null,
}, localize('statusBarNoFolderBackground', 'Status bar background color when no folder is opened. The status bar is shown in the bottom of the window.'));

export const STATUS_BAR_BORDER = registerColor('statusBar.border', {
  dark: null,
  light: null,
  hc: contrastBorder,
}, localize('statusBarBorder', 'Status bar border color separating to the sidebar and editor. The status bar is shown in the bottom of the window.'));

export const STATUS_BAR_NO_FOLDER_BORDER = registerColor('statusBar.noFolderBorder', {
  dark: STATUS_BAR_BORDER,
  light: STATUS_BAR_BORDER,
  hc: STATUS_BAR_BORDER,
}, localize('statusBarNoFolderBorder', 'Status bar border color separating to the sidebar and editor when no folder is opened. The status bar is shown in the bottom of the window.'));

export const STATUS_BAR_ITEM_ACTIVE_BACKGROUND = registerColor('statusBarItem.activeBackground', {
  dark: Color.white.transparent(0.18),
  light: Color.white.transparent(0.18),
  hc: Color.white.transparent(0.18),
}, localize('statusBarItemActiveBackground', 'Status bar item background color when clicking. The status bar is shown in the bottom of the window.'));

export const STATUS_BAR_ITEM_HOVER_BACKGROUND = registerColor('statusBarItem.hoverBackground', {
  dark: Color.white.transparent(0.12),
  light: Color.white.transparent(0.12),
  hc: Color.white.transparent(0.12),
}, localize('statusBarItemHoverBackground', 'Status bar item background color when hovering. The status bar is shown in the bottom of the window.'));

export const STATUS_BAR_PROMINENT_ITEM_FOREGROUND = registerColor('statusBarItem.prominentForeground', {
  dark: STATUS_BAR_FOREGROUND,
  light: STATUS_BAR_FOREGROUND,
  hc: STATUS_BAR_FOREGROUND,
}, localize('statusBarProminentItemForeground', 'Status bar prominent items foreground color. Prominent items stand out from other status bar entries to indicate importance. Change mode `Toggle Tab Key Moves Focus` from command palette to see an example. The status bar is shown in the bottom of the window.'));

export const STATUS_BAR_PROMINENT_ITEM_BACKGROUND = registerColor('statusBarItem.prominentBackground', {
  dark: Color.black.transparent(0.5),
  light: Color.black.transparent(0.5),
  hc: Color.black.transparent(0.5),
}, localize('statusBarProminentItemBackground', 'Status bar prominent items background color. Prominent items stand out from other status bar entries to indicate importance. Change mode `Toggle Tab Key Moves Focus` from command palette to see an example. The status bar is shown in the bottom of the window.'));

export const STATUS_BAR_PROMINENT_ITEM_HOVER_BACKGROUND = registerColor('statusBarItem.prominentHoverBackground', {
  dark: Color.black.transparent(0.3),
  light: Color.black.transparent(0.3),
  hc: Color.black.transparent(0.3),
}, localize('statusBarProminentItemHoverBackground', 'Status bar prominent items background color when hovering. Prominent items stand out from other status bar entries to indicate importance. Change mode `Toggle Tab Key Moves Focus` from command palette to see an example. The status bar is shown in the bottom of the window.'));

// < --- Activity Bar --- >

export const ACTIVITY_BAR_BACKGROUND = registerColor('activityBar.background', {
  dark: '#333333',
  light: '#2C2C2C',
  hc: '#000000',
}, localize('activityBarBackground', 'Activity bar background color. The activity bar is showing on the far left or right and allows to switch between views of the side bar.'));

export const ACTIVITY_BAR_FOREGROUND = registerColor('activityBar.foreground', {
  dark: Color.white,
  light: Color.white,
  hc: Color.white,
}, localize('activityBarForeground', 'Activity bar item foreground color when it is active. The activity bar is showing on the far left or right and allows to switch between views of the side bar.'));

export const ACTIVITY_BAR_INACTIVE_FOREGROUND = registerColor('activityBar.inactiveForeground', {
  dark: transparent(ACTIVITY_BAR_FOREGROUND, 0.6),
  light: transparent(ACTIVITY_BAR_FOREGROUND, 0.6),
  hc: Color.white,
}, localize('activityBarInActiveForeground', 'Activity bar item foreground color when it is inactive. The activity bar is showing on the far left or right and allows to switch between views of the side bar.'));

export const ACTIVITY_BAR_BORDER = registerColor('activityBar.border', {
  dark: null,
  light: null,
  hc: contrastBorder,
}, localize('activityBarBorder', 'Activity bar border color separating to the side bar. The activity bar is showing on the far left or right and allows to switch between views of the side bar.'));

export const ACTIVITY_BAR_DRAG_AND_DROP_BACKGROUND = registerColor('activityBar.dropBackground', {
  dark: Color.white.transparent(0.12),
  light: Color.white.transparent(0.12),
  hc: Color.white.transparent(0.12),
}, localize('activityBarDragAndDropBackground', 'Drag and drop feedback color for the activity bar items. The color should have transparency so that the activity bar entries can still shine through. The activity bar is showing on the far left or right and allows to switch between views of the side bar.'));

export const ACTIVITY_BAR_BADGE_BACKGROUND = registerColor('activityBarBadge.background', {
  dark: '#007ACC',
  light: '#007ACC',
  hc: '#000000',
}, localize('activityBarBadgeBackground', 'Activity notification badge background color. The activity bar is showing on the far left or right and allows to switch between views of the side bar.'));

export const ACTIVITY_BAR_BADGE_FOREGROUND = registerColor('activityBarBadge.foreground', {
  dark: Color.white,
  light: Color.white,
  hc: Color.white,
}, localize('activityBarBadgeForeground', 'Activity notification badge foreground color. The activity bar is showing on the far left or right and allows to switch between views of the side bar.'));

// < --- Remote --- >

export const STATUS_BAR_HOST_NAME_BACKGROUND = registerColor('statusBarItem.remoteBackground', {
  dark: ACTIVITY_BAR_BADGE_BACKGROUND,
  light: ACTIVITY_BAR_BADGE_BACKGROUND,
  hc: ACTIVITY_BAR_BADGE_BACKGROUND,
}, localize('statusBarItemHostBackground', 'Background color for the remote indicator on the status bar.'));

export const STATUS_BAR_HOST_NAME_FOREGROUND = registerColor('statusBarItem.remoteForeground', {
  dark: ACTIVITY_BAR_BADGE_FOREGROUND,
  light: ACTIVITY_BAR_BADGE_FOREGROUND,
  hc: ACTIVITY_BAR_BADGE_FOREGROUND,
}, localize('statusBarItemHostForeground', 'Foreground color for the remote indicator on the status bar.'));

export const EXTENSION_BADGE_REMOTE_BACKGROUND = registerColor('extensionBadge.remoteBackground', {
  dark: ACTIVITY_BAR_BADGE_BACKGROUND,
  light: ACTIVITY_BAR_BADGE_BACKGROUND,
  hc: ACTIVITY_BAR_BADGE_BACKGROUND,
}, localize('extensionBadge.remoteBackground', 'Background color for the remote badge in the extensions view'));

export const EXTENSION_BADGE_REMOTE_FOREGROUND = registerColor('extensionBadge.remoteForeground', {
  dark: ACTIVITY_BAR_BADGE_FOREGROUND,
  light: ACTIVITY_BAR_BADGE_FOREGROUND,
  hc: ACTIVITY_BAR_BADGE_FOREGROUND,
}, localize('extensionBadge.remoteForeground', 'Foreground color for the remote badge in the extensions view'));

// < --- Side Bar --- >

export const SIDE_BAR_BACKGROUND = registerColor('sideBar.background', {
  dark: '#252526',
  light: '#F3F3F3',
  hc: '#000000',
}, localize('sideBarBackground', 'Side bar background color. The side bar is the container for views like explorer and search.'));

export const SIDE_BAR_FOREGROUND = registerColor('sideBar.foreground', {
  dark: null,
  light: null,
  hc: null,
}, localize('sideBarForeground', 'Side bar foreground color. The side bar is the container for views like explorer and search.'));

export const SIDE_BAR_BORDER = registerColor('sideBar.border', {
  dark: null,
  light: null,
  hc: contrastBorder,
}, localize('sideBarBorder', 'Side bar border color on the side separating to the editor. The side bar is the container for views like explorer and search.'));

export const SIDE_BAR_TITLE_FOREGROUND = registerColor('sideBarTitle.foreground', {
  dark: SIDE_BAR_FOREGROUND,
  light: SIDE_BAR_FOREGROUND,
  hc: SIDE_BAR_FOREGROUND,
}, localize('sideBarTitleForeground', 'Side bar title foreground color. The side bar is the container for views like explorer and search.'));

export const SIDE_BAR_DRAG_AND_DROP_BACKGROUND = registerColor('sideBar.dropBackground', {
  dark: Color.white.transparent(0.12),
  light: Color.black.transparent(0.1),
  hc: Color.white.transparent(0.3),
}, localize('sideBarDragAndDropBackground', 'Drag and drop feedback color for the side bar sections. The color should have transparency so that the side bar sections can still shine through. The side bar is the container for views like explorer and search.'));

export const SIDE_BAR_SECTION_HEADER_BACKGROUND = registerColor('sideBarSectionHeader.background', {
  dark: Color.fromHex('#808080').transparent(0.2),
  light: Color.fromHex('#808080').transparent(0.2),
  hc: null,
}, localize('sideBarSectionHeaderBackground', 'Side bar section header background color. The side bar is the container for views like explorer and search.'));

export const SIDE_BAR_SECTION_HEADER_FOREGROUND = registerColor('sideBarSectionHeader.foreground', {
  dark: SIDE_BAR_FOREGROUND,
  light: SIDE_BAR_FOREGROUND,
  hc: SIDE_BAR_FOREGROUND,
}, localize('sideBarSectionHeaderForeground', 'Side bar section header foreground color. The side bar is the container for views like explorer and search.'));

export const SIDE_BAR_SECTION_HEADER_BORDER = registerColor('sideBarSectionHeader.border', {
  dark: contrastBorder,
  light: contrastBorder,
  hc: contrastBorder,
}, localize('sideBarSectionHeaderBorder', 'Side bar section header border color. The side bar is the container for views like explorer and search.'));

// < --- Quick Input -- >

export const QUICK_INPUT_BACKGROUND = registerColor('quickInput.background', {
  dark: SIDE_BAR_BACKGROUND,
  light: SIDE_BAR_BACKGROUND,
  hc: SIDE_BAR_BACKGROUND,
}, localize('quickInputBackground', 'Quick Input background color. The Quick Input widget is the container for views like the color theme picker'));

export const QUICK_INPUT_FOREGROUND = registerColor('quickInput.foreground', {
  dark: SIDE_BAR_FOREGROUND,
  light: SIDE_BAR_FOREGROUND,
  hc: SIDE_BAR_FOREGROUND,
}, localize('quickInputForeground', 'Quick Input foreground color. The Quick Input widget is the container for views like the color theme picker'));

// < --- Title Bar --- >

export const TITLE_BAR_ACTIVE_FOREGROUND = registerColor('titleBar.activeForeground', {
  dark: '#CCCCCC',
  light: '#333333',
  hc: '#FFFFFF',
}, localize('titleBarActiveForeground', 'Title bar foreground when the window is active. Note that this color is currently only supported on macOS.'));

export const TITLE_BAR_INACTIVE_FOREGROUND = registerColor('titleBar.inactiveForeground', {
  dark: transparent(TITLE_BAR_ACTIVE_FOREGROUND, 0.6),
  light: transparent(TITLE_BAR_ACTIVE_FOREGROUND, 0.6),
  hc: null,
}, localize('titleBarInactiveForeground', 'Title bar foreground when the window is inactive. Note that this color is currently only supported on macOS.'));

export const TITLE_BAR_ACTIVE_BACKGROUND = registerColor('titleBar.activeBackground', {
  dark: '#3C3C3C',
  light: '#DDDDDD',
  hc: '#000000',
}, localize('titleBarActiveBackground', 'Title bar background when the window is active. Note that this color is currently only supported on macOS.'));

export const TITLE_BAR_INACTIVE_BACKGROUND = registerColor('titleBar.inactiveBackground', {
  dark: transparent(TITLE_BAR_ACTIVE_BACKGROUND, 0.6),
  light: transparent(TITLE_BAR_ACTIVE_BACKGROUND, 0.6),
  hc: null,
}, localize('titleBarInactiveBackground', 'Title bar background when the window is inactive. Note that this color is currently only supported on macOS.'));

export const TITLE_BAR_BORDER = registerColor('titleBar.border', {
  dark: null,
  light: null,
  hc: contrastBorder,
}, localize('titleBarBorder', 'Title bar border color. Note that this color is currently only supported on macOS.'));

// < --- Menubar --- >

export const MENUBAR_SELECTION_FOREGROUND = registerColor('menubar.selectionForeground', {
  dark: TITLE_BAR_ACTIVE_FOREGROUND,
  light: TITLE_BAR_ACTIVE_FOREGROUND,
  hc: TITLE_BAR_ACTIVE_FOREGROUND,
}, localize('menubarSelectionForeground', 'Foreground color of the selected menu item in the menubar.'));

export const MENUBAR_SELECTION_BACKGROUND = registerColor('menubar.selectionBackground', {
  dark: transparent(Color.white, 0.1),
  light: transparent(Color.black, 0.1),
  hc: null,
}, localize('menubarSelectionBackground', 'Background color of the selected menu item in the menubar.'));

export const MENUBAR_SELECTION_BORDER = registerColor('menubar.selectionBorder', {
  dark: null,
  light: null,
  hc: activeContrastBorder,
}, localize('menubarSelectionBorder', 'Border color of the selected menu item in the menubar.'));

// < --- Notifications --- >

export const NOTIFICATIONS_CENTER_BORDER = registerColor('notificationCenter.border', {
  dark: null,
  light: null,
  hc: contrastBorder,
}, localize('notificationCenterBorder', 'Notifications center border color. Notifications slide in from the bottom right of the window.'));

export const NOTIFICATIONS_TOAST_BORDER = registerColor('notificationToast.border', {
  dark: null,
  light: null,
  hc: contrastBorder,
}, localize('notificationToastBorder', 'Notification toast border color. Notifications slide in from the bottom right of the window.'));

export const NOTIFICATIONS_FOREGROUND = registerColor('notifications.foreground', {
  dark: null,
  light: null,
  hc: null,
}, localize('notificationsForeground', 'Notifications foreground color. Notifications slide in from the bottom right of the window.'));

export const NOTIFICATIONS_BACKGROUND = registerColor('notifications.background', {
  dark: editorWidgetBackground,
  light: editorWidgetBackground,
  hc: editorWidgetBackground,
}, localize('notificationsBackground', 'Notifications background color. Notifications slide in from the bottom right of the window.'));

export const NOTIFICATIONS_LINKS = registerColor('notificationLink.foreground', {
  dark: textLinkForeground,
  light: textLinkForeground,
  hc: textLinkForeground,
}, localize('notificationsLink', 'Notification links foreground color. Notifications slide in from the bottom right of the window.'));

export const NOTIFICATIONS_CENTER_HEADER_FOREGROUND = registerColor('notificationCenterHeader.foreground', {
  dark: null,
  light: null,
  hc: null,
}, localize('notificationCenterHeaderForeground', 'Notifications center header foreground color. Notifications slide in from the bottom right of the window.'));

export const NOTIFICATIONS_CENTER_HEADER_BACKGROUND = registerColor('notificationCenterHeader.background', {
  dark: lighten(NOTIFICATIONS_BACKGROUND, 0.3),
  light: darken(NOTIFICATIONS_BACKGROUND, 0.05),
  hc: NOTIFICATIONS_BACKGROUND,
}, localize('notificationCenterHeaderBackground', 'Notifications center header background color. Notifications slide in from the bottom right of the window.'));

export const NOTIFICATIONS_BORDER = registerColor('notifications.border', {
  dark: NOTIFICATIONS_CENTER_HEADER_BACKGROUND,
  light: NOTIFICATIONS_CENTER_HEADER_BACKGROUND,
  hc: NOTIFICATIONS_CENTER_HEADER_BACKGROUND,
}, localize('notificationsBorder', 'Notifications border color separating from other notifications in the notifications center. Notifications slide in from the bottom right of the window.'));

// ----- color functions

export function darken(colorValue: ColorValue, factor: number): ColorFunction {
  return (theme) => {
    const color = resolveColorValue(colorValue, theme);
    if (color) {
      return color.darken(factor);
    }
    return undefined;
  };
}

export function lighten(colorValue: ColorValue, factor: number): ColorFunction {
  return (theme) => {
    const color = resolveColorValue(colorValue, theme);
    if (color) {
      return color.lighten(factor);
    }
    return undefined;
  };
}

export function transparent(colorValue: ColorValue, factor: number): ColorFunction {
  return (theme) => {
    const color = resolveColorValue(colorValue, theme);
    if (color) {
      return color.transparent(factor);
    }
    return undefined;
  };
}

export function oneOf(...colorValues: ColorValue[]): ColorFunction {
  return (theme) => {
    for (const colorValue of colorValues) {
      const color = resolveColorValue(colorValue, theme);
      if (color) {
        return color;
      }
    }
    return undefined;
  };
}

function lessProminent(colorValue: ColorValue, backgroundColorValue: ColorValue, factor: number, transparency: number): ColorFunction {
  return (theme) => {
    const from = resolveColorValue(colorValue, theme);
    if (from) {
      const backgroundColor = resolveColorValue(backgroundColorValue, theme);
      if (backgroundColor) {
        if (from.isDarkerThan(backgroundColor)) {
          return Color.getLighterColor(from, backgroundColor, factor).transparent(transparency);
        }
        return Color.getDarkerColor(from, backgroundColor, factor).transparent(transparency);
      }
      return from.transparent(factor * transparency);
    }
    return undefined;
  };
}

// ----- implementation

/**
 * @param colorValue Resolve a color value in the context of a theme
 */
function resolveColorValue(colorValue: ColorValue | null, theme: ITheme): Color | undefined {
  if (colorValue === null) {
    return undefined;
  } else if (typeof colorValue === 'string') {
    if (colorValue[0] === '#') {
      return Color.fromHex(colorValue);
    }
    return theme.getColor(colorValue);
  } else if (colorValue instanceof Color) {
    return colorValue;
  } else if (typeof colorValue === 'function') {
    return colorValue(theme);
  }
  return undefined;
}
