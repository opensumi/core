import { registerColor, transparent } from '../color-registry';
import { localize } from '@ali/ide-core-common';

// base colors
export const foreground = registerColor('foreground', { dark: '#CCCCCC', light: '#616161', hc: '#FFFFFF' }, localize('foreground', 'Overall foreground color. This color is only used if not overridden by a component.'));
export const errorForeground = registerColor('errorForeground', { dark: '#F48771', light: '#A1260D', hc: '#F48771' }, localize('errorForeground', 'Overall foreground color for error messages. This color is only used if not overridden by a component.'));
export const descriptionForeground = registerColor('descriptionForeground', { light: '#717171', dark: transparent(foreground, 0.7), hc: transparent(foreground, 0.7) }, localize('descriptionForeground', 'Foreground color for description text providing additional information, for example for a label.'));
export const iconForeground = registerColor('icon.foreground', { dark: '#C5C5C5', light: '#424242', hc: '#FFFFFF' }, localize('iconForeground', 'The default color for icons in the workbench.'));

export const focusBorder = registerColor('focusBorder', { dark: '#167CDB', light: '#167CDB', hc: null }, localize('focusBorder', 'Overall border color for focused elements. This color is only used if not overridden by a component.'));

export const contrastBorder = registerColor('contrastBorder', { light: null, dark: null, hc: '#6FC3DF' }, localize('contrastBorder', 'An extra border around elements to separate them from others for greater contrast.'));
export const activeContrastBorder = registerColor('contrastActiveBorder', { light: null, dark: null, hc: focusBorder }, localize('activeContrastBorder', 'An extra border around active elements to separate them from others for greater contrast.'));

export const selectionBackground = registerColor('selection.background', { light: null, dark: null, hc: null }, localize('selectionBackground', 'The background color of text selections in the workbench (e.g. for input fields or text areas). Note that this does not apply to selections within the editor.'));

export const widgetShadow = registerColor('widget.shadow', { dark: '#000000', light: '#A8A8A8', hc: null }, localize('widgetShadow', 'Shadow color of widgets such as find/replace inside the editor.'));

// customed

// base custom colors
// 强调色
export const accentForeground = registerColor(
  'kt.accentForeground',
  { dark: foreground, light: foreground, hc: foreground },
  localize('accentForeground', 'Accent foreground color. This color is only used if not overridden by a component.'),
);

export const disableForeground = registerColor(
  'kt.disableForeground',
  { light: transparent(foreground, 0.3), dark: transparent(foreground, 0.3), hc: transparent(foreground, 0.3) },
  localize('disableForeground', 'Foreground color for text providing disabled information'),
);

export const iconSecondaryForeground = registerColor(
  'kt.icon.secondaryForeground',
  { dark: iconForeground, light: iconForeground, hc: iconForeground },
  localize('secondaryForeground', 'The secondary color for icons in the workbench.'),
);
