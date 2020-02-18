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

export const errorIconForeground = registerColor(
  'kt.errorIconForeground',
  { dark: '#DB4345', light: '#FF4D4F', hc: iconForeground },
  localize('errorIconForeground', 'Foreground color for error icon'),
);

export const errorBackground = registerColor(
  'kt.errorBackground',
  { dark: '#D21F2840', light: '#FF787540', hc: null },
  localize('errorBackground', 'Background color for error text'),
);

export const warningIconForeground = registerColor(
  'kt.warningIconForeground',
  { dark: '#DBA936', light: '#FFC53D', hc: iconForeground },
  localize('warningIconForeground', 'Foreground color for warning icon'),
);

export const warningBackground = registerColor(
  'kt.warningBackground',
  { dark: '#D7951340', light: '#FFD66640', hc: null },
  localize('warningBackground', 'Background color for warning text'),
);

export const succesIconForeground = registerColor(
  'kt.successIconForeground',
  { dark: '#DBA936', light: '#73D13D', hc: iconForeground },
  localize('successIconForeground', 'Foreground color for success icon'),
);

export const successBackground = registerColor(
  'kt.successBackground',
  { dark: '#D7951340', light: '#95DE6440', hc: null },
  localize('successBackground', 'Background color for success text'),
);

export const infoIconForeground = registerColor(
  'kt.infoIconForeground',
  { dark: '#3895EB', light: '#3D9CF5', hc: iconForeground },
  localize('infoIconForeground', 'Foreground color for info icon'),
);

export const infoBackground = registerColor(
  'kt.infoBackground',
  { dark: '#167CDB40', light: '#6EB6FA40', hc: null },
  localize('infoBackground', 'Background color for info text'),
);

export const hintIconForeground = registerColor(
  'kt.hintIconForeground',
  { dark: '#868C91', light: '#999999', hc: iconForeground },
  localize('hintIconForeground', 'Foreground color for hint icon'),
);

export const hintBackground = registerColor(
  'kt.hintBackground',
  { dark: '#5F656B40', light: '#CCCCCC40', hc: null },
  localize('hintBackground', 'Background color for hint text'),
);
