import { localize } from '@opensumi/ide-core-common';

import { darken, lighten, registerColor } from '../../utils';
import { selectBackground, selectBorder, selectForeground } from '../dropdown';
import {
  inputActiveOptionBackground,
  inputActiveOptionBorder,
  inputBackground,
  inputForeground,
  inputPlaceholderForeground,
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
  { dark: inputForeground, light: inputForeground, hcDark: inputForeground, hcLight: inputForeground },
  localize('ktSelectForeground', 'Select Foreground color.'),
);
export const ktSelectBackground = registerColor(
  'kt.select.background',
  { dark: inputBackground, light: inputBackground, hcDark: inputBackground, hcLight: inputBackground },
  localize('ktSelectBackground', 'Select Background color.'),
);
export const ktSelectBorder = registerColor(
  'kt.select.border',
  { dark: settingsSelectBorder, light: settingsSelectBorder, hcDark: selectBorder, hcLight: selectBorder },
  localize('ktSelectBorder', 'Select Border color.'),
);
export const ktSelectPlaceholderForeground = registerColor(
  'kt.select.placeholderForeground',
  {
    dark: inputPlaceholderForeground,
    light: inputPlaceholderForeground,
    hcDark: inputPlaceholderForeground,
    hcLight: inputPlaceholderForeground,
  },
  localize('ktSelectPlaceholder', 'Select Placeholder Foreground color.'),
);
export const ktSelectDisableBackground = registerColor(
  'kt.select.disableBackground',
  {
    dark: listInactiveSelectionBackground,
    light: listInactiveSelectionBackground,
    hcDark: listInactiveSelectionBackground,
    hcLight: listInactiveSelectionBackground,
  },
  localize('ktSelectDisableBackground', 'Select Disable Background color.'),
);
export const ktSelectDisableForeground = registerColor(
  'kt.select.disableForeground',
  {
    dark: listInactiveSelectionForeground,
    light: listInactiveSelectionForeground,
    hcDark: listInactiveSelectionForeground,
    hcLight: listInactiveSelectionForeground,
  },
  localize('ktSelectDisableForeground', 'Select Disable Foreground color.'),
);
export const ktSelectWarningForeground = registerColor(
  'kt.select.warningForeground',
  {
    dark: listWarningForeground,
    light: listWarningForeground,
    hcDark: listWarningForeground,
    hcLight: listWarningForeground,
  },
  localize('ktSelectWarningForeground', 'Select Warning Foreground.'),
);
export const ktSelectErrorForeground = registerColor(
  'kt.select.warningForeground',
  { dark: listErrorForeground, light: listErrorForeground, hcDark: listErrorForeground, hcLight: listErrorForeground },
  localize('ktSelectDisableForeground', 'Select Disable Foreground color.'),
);
export const ktSelectWarningColor = registerColor(
  'kt.select.warningColor',
  { dark: '#D77915', light: '#D77915', hcDark: null, hcLight: null },
  localize('ktSelectWarningColor', 'Select Warning Color.'),
);

export const ktSelectOptionActiveBackground = registerColor(
  'selectOption.activeBackground',
  {
    dark: inputActiveOptionBackground,
    light: inputActiveOptionBackground,
    hcDark: inputActiveOptionBackground,
    hcLight: inputActiveOptionBackground,
  },
  localize('ktSelectOptionActiveBackground', 'Select Option Active Background color.'),
);
export const ktSelectOptionActiveBorder = registerColor(
  'kt.selectOption.activeBorder',
  {
    dark: inputActiveOptionBorder,
    light: inputActiveOptionBorder,
    hcDark: inputActiveOptionBorder,
    hcLight: inputActiveOptionBorder,
  },
  localize('ktSelectOptionActiveBorder', 'Select Option Active Border color.'),
);

/* select dropdown */
export const ktSelectDropdownForeground = registerColor(
  'kt.selectDropdown.foreground',
  { dark: selectForeground, light: selectForeground, hcDark: selectForeground, hcLight: selectForeground },
  localize('ktSelectDropdownForeground', 'Select Dropdown Foreground color.'),
);
export const ktSelectDropdownBackground = registerColor(
  'kt.selectDropdown.background',
  { dark: selectBackground, light: selectBackground, hcDark: selectBackground, hcLight: selectBackground },
  localize('ktSelectDropdownBackground', 'Select Dropdown Background color.'),
);
export const ktSelectDropdownHoverBackground = registerColor(
  'kt.selectDropdown.hoverBackground',
  { dark: listHoverBackground, light: listHoverBackground, hcDark: listHoverBackground, hcLight: listHoverBackground },
  localize('ktSelectDropdownHoverBackground', 'Select Dropdown Hover Background color.'),
);
export const ktSelectDropdownSelectionBackground = registerColor(
  'kt.selectDropdown.selectionBackground',
  {
    dark: listActiveSelectionBackground,
    light: listActiveSelectionBackground,
    hcDark: listActiveSelectionBackground,
    hcLight: listActiveSelectionBackground,
  },
  localize('ktSelectDropdownSelectionBackground', 'Select Dropdown Selection Background color.'),
);
export const ktSelectDropdownSelectionForeground = registerColor(
  'kt.selectDropdown.selectionForeground',
  {
    dark: listActiveSelectionForeground,
    light: listActiveSelectionForeground,
    hcDark: listActiveSelectionForeground,
    hcLight: listActiveSelectionForeground,
  },
  localize('ktSelectDropdownSelectionForeground', 'Select Dropdown Selection Foreground color.'),
);
export const ktSelectDropdownTeamForeground = registerColor(
  'kt.selectDropdown.teamForeground',
  {
    dark: darken(ktSelectDropdownForeground, 0.2),
    light: lighten(ktSelectDropdownForeground, 0.2),
    hcDark: null,
    hcLight: null,
  },
  localize('ktSelectDropdownSelectionBackground', 'Select Dropdown Selection Background color.'),
);
