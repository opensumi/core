import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../../utils';
import { contrastBorder, selectionBackground } from '../base';
import { inputActiveOptionBorder, inputBorder } from '../input';

export const ktInputBorder = registerColor(
  'kt.input.border',
  { dark: inputBorder, light: inputBorder, hcDark: contrastBorder, hcLight: contrastBorder },
  localize('ktInputBoxBorder', 'Input box border.'),
);
export const ktInputDisableForeground = registerColor(
  'kt.input.disableForeground',
  { dark: '#5F656B', light: '#5F656B', hcDark: null, hcLight: null },
  localize('ktInputDisableForeground', 'Input box disabled foreground color.'),
);
export const ktInputDisableBackground = registerColor(
  'kt.input.disableBackground',
  { dark: '#5F656B40', light: '#5F656B40', hcDark: null, hcLight: null },
  localize('ktInputDisableBackground', 'Input box disabled background color.'),
);
export const ktInputSelectionBackground = registerColor(
  'kt.input.selectionBackground',
  { dark: selectionBackground, light: selectionBackground, hcDark: selectionBackground, hcLight: selectionBackground },
  localize('Input Selection background color.'),
);

export const ktInputValidationWarningTextForeground = registerColor(
  'kt.inputValidation.warningTextForeground',
  { dark: '#D77915', light: '#D77915', hcDark: null, hcLight: null },
  localize('Input Validation warning Text foreground color.'),
);
export const ktInputValidationErrorTextForeground = registerColor(
  'kt.inputValidation.errorTextForeground',
  { dark: '#D21F28', light: '#D21F28', hcDark: null, hcLight: null },
  localize('Input Validation Error Text foreground color.'),
);

export const ktInputOptionHoverBorder = registerColor(
  'kt.inputOption.hoverBorder',
  {
    dark: inputActiveOptionBorder,
    light: inputActiveOptionBorder,
    hcDark: contrastBorder,
    hcLight: contrastBorder,
  },
  localize('inputOptionHoverBorder', 'Border color of hovering options in input fields.'),
);
