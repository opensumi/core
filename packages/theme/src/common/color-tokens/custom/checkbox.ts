import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../../color-registry';

export const ktCheckboxHoverBackground = registerColor(
  'kt.checkbox.hoverBackground',
  { dark: '#00000040', light: '#FFFFFF', hc: null },
  localize('ktCheckboxHoverBackground', 'Checkbox Hover Background color.'),
);
export const ktCheckboxHoverBorder = registerColor(
  'kt.checkbox.hoverBorder',
  { dark: '#167CDB', light: '#167CDB', hc: null },
  localize('ktCheckboxHoverBorder', 'Checkbox Hover Border color.'),
);

export const ktCheckboxSelectionForeground = registerColor(
  'kt.checkbox.selectionForeground',
  { dark: '#FFFFFF', light: '#FFFFFF', hc: null },
  localize('ktCheckboxSelectionForeground', 'Checkbox Selection Foreground color.'),
);
export const ktCheckboxSelectionBackground = registerColor(
  'kt.checkbox.selectionBackground',
  { dark: '#167CDB', light: '#167CDB', hc: null },
  localize('ktCheckboxSelectionBackground', 'Checkbox Selection Background color.'),
);

export const ktCheckboxDisableForeground = registerColor(
  'kt.checkbox.disableForeground',
  { dark: '#5F656B', light: '#5F656B', hc: null },
  localize('ktCheckboxDisableForeground', 'Checkbox Disable Foreground color.'),
);
export const ktCheckboxDisableBackground = registerColor(
  'kt.checkbox.disableBackground',
  { dark: '#5F656B40', light: '#5F656B40', hc: null },
  localize('ktCheckboxDisableBackground', 'Checkbox Disable Background color.'),
);
