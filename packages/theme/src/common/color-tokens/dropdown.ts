import { localize } from '@opensumi/ide-core-common';

import { Color } from '../../common/color';
import { registerColor } from '../utils';

import { contrastBorder, foreground } from './base';

export const selectBackground = registerColor(
  'dropdown.background',
  { dark: '#3C3C3C', light: Color.white, hcDark: Color.black, hcLight: Color.white },
  localize('dropdownBackground', 'Dropdown background.'),
);
export const selectListBackground = registerColor(
  'dropdown.listBackground',
  { dark: null, light: null, hcDark: Color.black, hcLight: Color.white },
  localize('dropdownListBackground', 'Dropdown list background.'),
);
export const selectForeground = registerColor(
  'dropdown.foreground',
  { dark: '#F0F0F0', light: null, hcDark: Color.white, hcLight: foreground },
  localize('dropdownForeground', 'Dropdown foreground.'),
);
export const selectBorder = registerColor(
  'dropdown.border',
  { dark: selectBackground, light: '#CECECE', hcDark: contrastBorder, hcLight: contrastBorder },
  localize('dropdownBorder', 'Dropdown border.'),
);
