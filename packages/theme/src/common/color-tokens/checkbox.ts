import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../color-registry';

export const checkboxBorder = registerColor(
  'checkbox.border',
  { dark: null, light: null, hc: null },
  localize('checkboxBorder', 'Checkbox Border color.'),
);
export const checkboxBackground = registerColor(
  'checkbox.background',
  { dark: '#00000040', light: '#FFFFFF', hc: null },
  localize('checkboxBackground', 'Checkbox Background color.'),
);
