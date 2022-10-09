import { localize } from '@opensumi/ide-core-common';

import { transparent, registerColor } from '../utils';

import { hcBorderColor } from './basic-color';

// base colors
export const foreground = registerColor(
  'foreground',
  { dark: '#CCCCCC', light: '#616161', hcDark: '#FFFFFF', hcLight: '#292929' },
  localize('foreground', 'Overall foreground color. This color is only used if not overridden by a component.'),
);
export const errorForeground = registerColor(
  'errorForeground',
  { dark: '#F48771', light: '#A1260D', hcDark: '#F48771', hcLight: '#B5200D' },
  localize(
    'errorForeground',
    'Overall foreground color for error messages. This color is only used if not overridden by a component.',
  ),
);
export const descriptionForeground = registerColor(
  'descriptionForeground',
  {
    light: '#717171',
    dark: transparent(foreground, 0.7),
    hcDark: transparent(foreground, 0.7),
    hcLight: transparent(foreground, 0.7),
  },
  localize(
    'descriptionForeground',
    'Foreground color for description text providing additional information, for example for a label.',
  ),
);
export const iconForeground = registerColor(
  'icon.foreground',
  { dark: '#C5C5C5', light: '#424242', hcDark: '#FFFFFF', hcLight: '#292929' },
  localize('iconForeground', 'The default color for icons in the workbench.'),
);

export const focusBorder = registerColor(
  'focusBorder',
  { dark: '#007FD4', light: '#0090F1', hcDark: '#F38518', hcLight: '#0F4A85' },
  localize(
    'focusBorder',
    'Overall border color for focused elements. This color is only used if not overridden by a component.',
  ),
);
export const sashHoverBorder = registerColor(
  'sash.hoverBorder',
  { dark: focusBorder, light: focusBorder, hcDark: focusBorder, hcLight: focusBorder },
  localize('sashActiveBorder', 'Border color of active sashes.'),
);

export const contrastBorder = registerColor(
  'contrastBorder',
  { light: null, dark: null, hcDark: '#6FC3DF', hcLight: '#0F4A85' },
  localize('contrastBorder', 'An extra border around elements to separate them from others for greater contrast.'),
);
export const activeContrastBorder = registerColor(
  'contrastActiveBorder',
  { light: null, dark: null, hcDark: focusBorder, hcLight: focusBorder },
  localize(
    'activeContrastBorder',
    'An extra border around active elements to separate them from others for greater contrast.',
  ),
);

export const selectionBackground = registerColor(
  'selection.background',
  { light: null, dark: null, hcDark: null, hcLight: null },
  localize(
    'selectionBackground',
    'The background color of text selections in the workbench (e.g. for input fields or text areas). Note that this does not apply to selections within the editor.',
  ),
);

export const widgetShadow = registerColor(
  'widget.shadow',
  { dark: '#000000', light: '#A8A8A8', hcDark: '#A5A5A5', hcLight: '#7F7F7F' },
  localize('widgetShadow', 'Shadow color of widgets such as find/replace inside the editor.'),
);

export const disabledForeground = registerColor(
  'disabledForeground',
  { dark: '#CCCCCC80', light: '#61616180', hcDark: '#A5A5A5', hcLight: '#7F7F7F' },
  localize(
    'disabledForeground',
    'Overall foreground for disabled elements. This color is only used if not overridden by a component.',
  ),
);
