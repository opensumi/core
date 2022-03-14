import { localize } from '@opensumi/ide-core-common';

import { Color } from '../../common/color';
import { registerColor } from '../color-registry';

import { contrastBorder } from './base';

export const dropdownBackground = registerColor(
  'dropdown.background',
  { dark: '#3C3C3C', light: Color.white, hc: Color.black },
  localize('dropdownBackground', 'Dropdown background.'),
);
export const dropdownListBackground = registerColor(
  'dropdown.listBackground',
  { dark: null, light: null, hc: Color.black },
  localize('dropdownListBackground', 'Dropdown list background.'),
);
export const dropdownForeground = registerColor(
  'dropdown.foreground',
  { dark: '#F0F0F0', light: null, hc: Color.white },
  localize('dropdownForeground', 'Dropdown foreground.'),
);
export const dropdownBorder = registerColor(
  'dropdown.border',
  { dark: dropdownBackground, light: '#CECECE', hc: contrastBorder },
  localize('dropdownBorder', 'Dropdown border.'),
);
