import { localize } from '@opensumi/ide-core-common';

import { Color } from '../../common/color';
import { registerColor, transparent } from '../utils';

import { contrastBorder, focusBorder, foreground } from './base';
import { secondaryForegroundColor } from './basic-color';

export const inputBorder = registerColor(
  'input.border',
  { dark: '#00000000', light: '#00000000', hcDark: contrastBorder, hcLight: contrastBorder },
  localize('inputBoxBorder', 'Input box border.'),
);
export const inputBackground = registerColor(
  'input.background',
  { dark: '#00000040', light: Color.white, hcDark: Color.black, hcLight: Color.white },
  localize('inputBoxBackground', 'Input box background.'),
);
export const inputForeground = registerColor(
  'input.foreground',
  { dark: foreground, light: foreground, hcDark: foreground, hcLight: foreground },
  localize('inputBoxForeground', 'Input box foreground.'),
);
export const inputPlaceholderForeground = registerColor(
  'input.placeholderForeground',
  {
    light: transparent(foreground, 0.5),
    dark: transparent(foreground, 0.5),
    hcDark: transparent(foreground, 0.7),
    hcLight: transparent(foreground, 0.7),
  },
  localize('inputPlaceholderForeground', 'Input box foreground color for placeholder text.'),
);

export const inputActiveOptionBorder = registerColor(
  'inputOption.activeBorder',
  { dark: '#007ACC', light: '#007ACC', hcDark: contrastBorder, hcLight: contrastBorder },
  localize('inputBoxActiveOptionBorder', 'Border color of activated options in input fields.'),
);
export const inputActiveOptionHoverBackground = registerColor(
  'inputOption.hoverBackground',
  { dark: '#5a5d5e80', light: '#b8b8b850', hcDark: null, hcLight: null },
  localize('inputOption.hoverBackground', 'Background color of activated options in input fields.'),
);
export const inputActiveOptionBackground = registerColor(
  'inputOption.activeBackground',
  {
    dark: transparent(focusBorder, 0.4),
    light: transparent(focusBorder, 0.2),
    hcDark: Color.transparent,
    hcLight: Color.transparent,
  },
  localize('inputOption.activeBackground', 'Background hover color of options in input fields.'),
);
export const inputActiveOptionForeground = registerColor(
  'inputOption.activeForeground',
  { dark: Color.white, light: Color.black, hcDark: null, hcLight: foreground },
  localize('inputOption.activeForeground', 'Foreground color of activated options in input fields.'),
);

export const inputValidationInfoBackground = registerColor(
  'inputValidation.infoBackground',
  { dark: '#063B49', light: '#D6ECF2', hcDark: Color.black, hcLight: Color.white },
  localize('inputValidationInfoBackground', 'Input validation background color for information severity.'),
);
export const inputValidationInfoForeground = registerColor(
  'inputValidation.infoForeground',
  { dark: null, light: null, hcDark: null, hcLight: foreground },
  localize('inputValidationInfoForeground', 'Input validation foreground color for information severity.'),
);
export const inputValidationInfoBorder = registerColor(
  'inputValidation.infoBorder',
  { dark: '#007acc', light: '#007acc', hcDark: contrastBorder, hcLight: contrastBorder },
  localize('inputValidationInfoBorder', 'Input validation border color for information severity.'),
);
export const inputValidationWarningBackground = registerColor(
  'inputValidation.warningBackground',
  { dark: '#352A05', light: '#F6F5D2', hcDark: Color.black, hcLight: Color.white },
  localize('inputValidationWarningBackground', 'Input validation background color for warning severity.'),
);
export const inputValidationWarningForeground = registerColor(
  'inputValidation.warningForeground',
  { dark: null, light: null, hcDark: null, hcLight: foreground },
  localize('inputValidationWarningForeground', 'Input validation foreground color for warning severity.'),
);
export const inputValidationWarningBorder = registerColor(
  'inputValidation.warningBorder',
  { dark: '#B89500', light: '#B89500', hcDark: contrastBorder, hcLight: contrastBorder },
  localize('inputValidationWarningBorder', 'Input validation border color for warning severity.'),
);
export const inputValidationErrorBackground = registerColor(
  'inputValidation.errorBackground',
  { dark: '#5A1D1D', light: '#F2DEDE', hcDark: Color.black, hcLight: Color.white },
  localize('inputValidationErrorBackground', 'Input validation background color for error severity.'),
);
export const inputValidationErrorForeground = registerColor(
  'inputValidation.errorForeground',
  { dark: null, light: null, hcDark: null, hcLight: foreground },
  localize('inputValidationErrorForeground', 'Input validation foreground color for error severity.'),
);
export const inputValidationErrorBorder = registerColor(
  'inputValidation.errorBorder',
  { dark: '#BE1100', light: '#BE1100', hcDark: contrastBorder, hcLight: contrastBorder },
  localize('inputValidationErrorBorder', 'Input validation border color for error severity.'),
);
