import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../../utils';

export const ktCheckboxHoverBackground = registerColor(
  'kt.checkbox.hoverBackground',
  { dark: '#00000040', light: '#FFFFFF', hcDark: null, hcLight: null },
  localize('ktCheckboxHoverBackground', 'Checkbox Hover Background color.'),
);
export const ktCheckboxHoverBorder = registerColor(
  'kt.checkbox.hoverBorder',
  { dark: '#167CDB', light: '#167CDB', hcDark: null, hcLight: null },
  localize('ktCheckboxHoverBorder', 'Checkbox Hover Border color.'),
);

export const ktCheckboxSelectionForeground = registerColor(
  'kt.checkbox.selectionForeground',
  { dark: '#FFFFFF', light: '#FFFFFF', hcDark: null, hcLight: null },
  localize('ktCheckboxSelectionForeground', 'Checkbox Selection Foreground color.'),
);
export const ktCheckboxSelectionBackground = registerColor(
  'kt.checkbox.selectionBackground',
  { dark: '#167CDB', light: '#167CDB', hcDark: null, hcLight: null },
  localize('ktCheckboxSelectionBackground', 'Checkbox Selection Background color.'),
);

export const ktCheckboxDisableForeground = registerColor(
  'kt.checkbox.disableForeground',
  { dark: '#5F656B', light: '#5F656B', hcDark: null, hcLight: null },
  localize('ktCheckboxDisableForeground', 'Checkbox Disable Foreground color.'),
);
export const ktCheckboxDisableBackground = registerColor(
  'kt.checkbox.disableBackground',
  { dark: '#5F656B40', light: '#5F656B40', hcDark: null, hcLight: null },
  localize('ktCheckboxDisableBackground', 'Checkbox Disable Background color.'),
);
