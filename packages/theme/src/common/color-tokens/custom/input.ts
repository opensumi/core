import { localize } from '@opensumi/ide-core-common';

import { registerColor, contrastBorder } from '../../color-registry';
import { inputBorder, inputOptionActiveBorder } from '../input';

export const ktInputBorder = registerColor(
  'kt.input.border',
  { dark: inputBorder, light: inputBorder, hc: contrastBorder },
  localize('ktInputBoxBorder', 'Input box border.'),
);
export const ktInputDisableForeground = registerColor(
  'kt.input.disableForeground',
  { dark: '#5F656B', light: '#5F656B', hc: null },
  localize('ktInputDisableForeground', 'Input box disabled foreground color.'),
);
export const ktInputDisableBackground = registerColor(
  'kt.input.disableBackground',
  { dark: '#5F656B40', light: '#5F656B40', hc: null },
  localize('ktInputDisableBackground', 'Input box disabled background color.'),
);
export const ktInputSelectionBackground = registerColor(
  'kt.input.selectionBackground',
  { dark: '#1A66AC', light: '#1A66AC', hc: null },
  localize('Input Selection background color.'),
);

export const ktInputValidationWarningTextForeground = registerColor(
  'kt.inputValidation.warningTextForeground',
  { dark: '#D77915', light: '#D77915', hc: null },
  localize('Input Validation warning Text foreground color.'),
);
export const ktInputValidationErrorTextForeground = registerColor(
  'kt.inputValidation.errorTextForeground',
  { dark: '#D21F28', light: '#D21F28', hc: null },
  localize('Input Validation Error Text foreground color.'),
);

export const ktInputOptionHoverBorder = registerColor(
  'kt.inputOption.hoverBorder',
  {
    dark: inputOptionActiveBorder,
    light: inputOptionActiveBorder,
    hc: contrastBorder,
  },
  localize('inputOptionHoverBorder', 'Border color of hovering options in input fields.'),
);
