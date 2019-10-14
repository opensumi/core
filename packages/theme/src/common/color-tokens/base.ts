import { registerColor, transparent } from '../color-registry';
import { Color } from '../../common/color';
import { localize } from '@ali/ide-core-common';

// ----- base colors
export const foreground = registerColor('foreground', { dark: '#CCCCCC', light: '#616161', hc: '#FFFFFF' }, localize('foreground', 'Overall foreground color. This color is only used if not overridden by a component.'));
export const errorForeground = registerColor('errorForeground', { dark: '#F48771', light: '#A1260D', hc: '#F48771' }, localize('errorForeground', 'Overall foreground color for error messages. This color is only used if not overridden by a component.'));
export const descriptionForeground = registerColor('descriptionForeground', { light: '#717171', dark: transparent(foreground, 0.7), hc: transparent(foreground, 0.7) }, localize('descriptionForeground', 'Foreground color for description text providing additional information, for example for a label.'));

export const focusBorder = registerColor('focusBorder', { dark: Color.fromHex('#0E639C').transparent(0.8), light: Color.fromHex('#007ACC').transparent(0.4), hc: '#F38518' }, localize('focusBorder', 'Overall border color for focused elements. This color is only used if not overridden by a component.'));

export const contrastBorder = registerColor('contrastBorder', { light: null, dark: null, hc: '#6FC3DF' }, localize('contrastBorder', 'An extra border around elements to separate them from others for greater contrast.'));
export const activeContrastBorder = registerColor('contrastActiveBorder', { light: null, dark: null, hc: focusBorder }, localize('activeContrastBorder', 'An extra border around active elements to separate them from others for greater contrast.'));

export const selectionBackground = registerColor('selection.background', { light: null, dark: null, hc: null }, localize('selectionBackground', 'The background color of text selections in the workbench (e.g. for input fields or text areas). Note that this does not apply to selections within the editor.'));

export const widgetShadow = registerColor('widget.shadow', { dark: '#000000', light: '#A8A8A8', hc: null }, localize('widgetShadow', 'Shadow color of widgets such as find/replace inside the editor.'));
