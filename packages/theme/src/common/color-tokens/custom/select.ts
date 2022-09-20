import { localize } from '@opensumi/ide-core-common';

import { darken, lighten, registerColor } from '../../utils';
import { dropdownBackground, dropdownBorder, dropdownForeground } from '../dropdown';
import {
  inputForeground,
  inputBackground,
  inputPlaceholderForeground,
  inputOptionActiveBorder,
  inputOptionActiveBackground,
} from '../input';
import {
  listActiveSelectionBackground,
  listActiveSelectionForeground,
  listErrorForeground,
  listHoverBackground,
  listInactiveSelectionBackground,
  listInactiveSelectionForeground,
  listWarningForeground,
} from '../list-tree';
import { settingsSelectBorder } from '../settings';

export const ktSelectForeground = registerColor(
  'kt.select.foreground',
  { dark: inputForeground, light: inputForeground, hc: inputForeground },
  localize('ktSelectForeground', 'Select Foreground color.'),
);
export const ktSelectBackground = registerColor(
  'kt.select.background',
  { dark: inputBackground, light: inputBackground, hc: inputBackground },
  localize('ktSelectBackground', 'Select Background color.'),
);
export const ktSelectBorder = registerColor(
  'kt.select.border',
  { dark: settingsSelectBorder, light: settingsSelectBorder, hc: dropdownBorder },
  localize('ktSelectBorder', 'Select Border color.'),
);
export const ktSelectPlaceholderForeground = registerColor(
  'kt.select.placeholderForeground',
  { dark: inputPlaceholderForeground, light: inputPlaceholderForeground, hc: inputPlaceholderForeground },
  localize('ktSelectPlaceholder', 'Select Placeholder Foreground color.'),
);
export const ktSelectDisableBackground = registerColor(
  'kt.select.disableBackground',
  {
    dark: listInactiveSelectionBackground,
    light: listInactiveSelectionBackground,
    hc: listInactiveSelectionBackground,
  },
  localize('ktSelectDisableBackground', 'Select Disable Background color.'),
);
export const ktSelectDisableForeground = registerColor(
  'kt.select.disableForeground',
  {
    dark: listInactiveSelectionForeground,
    light: listInactiveSelectionForeground,
    hc: listInactiveSelectionForeground,
  },
  localize('ktSelectDisableForeground', 'Select Disable Foreground color.'),
);
export const ktSelectWarningForeground = registerColor(
  'kt.select.warningForeground',
  { dark: listWarningForeground, light: listWarningForeground, hc: listWarningForeground },
  localize('ktSelectWarningForeground', 'Select Warning Foreground.'),
);
export const ktSelectErrorForeground = registerColor(
  'kt.select.warningForeground',
  { dark: listErrorForeground, light: listErrorForeground, hc: listErrorForeground },
  localize('ktSelectErrorForeground', 'Select Error Foreground.'),
);

export const ktSelectOptionActiveBackground = registerColor(
  'selectOption.activeBackground',
  { dark: inputOptionActiveBackground, light: inputOptionActiveBackground, hc: inputOptionActiveBackground },
  localize('ktSelectOptionActiveBackground', 'Select Option Active Background color.'),
);
export const ktSelectOptionActiveBorder = registerColor(
  'kt.selectOption.activeBorder',
  { dark: inputOptionActiveBorder, light: inputOptionActiveBorder, hc: inputOptionActiveBorder },
  localize('ktSelectOptionActiveBorder', 'Select Option Active Border color.'),
);

/* select dropdown */
export const ktSelectDropdownForeground = registerColor(
  'kt.selectDropdown.foreground',
  { dark: dropdownForeground, light: dropdownForeground, hc: dropdownForeground },
  localize('ktSelectDropdownForeground', 'Select Dropdown Foreground color.'),
);
export const ktSelectDropdownBackground = registerColor(
  'kt.selectDropdown.background',
  { dark: dropdownBackground, light: dropdownBackground, hc: dropdownBackground },
  localize('ktSelectDropdownBackground', 'Select Dropdown Background color.'),
);
export const ktSelectDropdownHoverBackground = registerColor(
  'kt.selectDropdown.hoverBackground',
  { dark: listHoverBackground, light: listHoverBackground, hc: listHoverBackground },
  localize('ktSelectDropdownHoverBackground', 'Select Dropdown Hover Background color.'),
);
export const ktSelectDropdownSelectionBackground = registerColor(
  'kt.selectDropdown.selectionBackground',
  { dark: listActiveSelectionBackground, light: listActiveSelectionBackground, hc: listActiveSelectionBackground },
  localize('ktSelectDropdownSelectionBackground', 'Select Dropdown Selection Background color.'),
);
export const ktSelectDropdownSelectionForeground = registerColor(
  'kt.selectDropdown.selectionForeground',
  { dark: listActiveSelectionForeground, light: listActiveSelectionForeground, hc: listActiveSelectionForeground },
  localize('ktSelectDropdownSelectionForeground', 'Select Dropdown Selection Foreground color.'),
);
export const ktSelectDropdownTeamForeground = registerColor(
  'kt.selectDropdown.teamForeground',
  { dark: darken(ktSelectDropdownBackground, 0.2), light: lighten(ktSelectDropdownBackground, 0.2), hc: null },
  localize('ktSelectDropdownSelectionBackground', 'Select Dropdown Selection Background color.'),
);
