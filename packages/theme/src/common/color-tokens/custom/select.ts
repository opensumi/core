import { localize } from '@ali/ide-core-common';
import { registerColor } from '../../color-registry';

export const ktSelectForeground = registerColor('kt.select.foreground', { dark: '#D7DBDE', light: '#D7DBDE', hc: null }, localize('ktSelectForeground', 'Select Foreground color.'));
export const ktSelectBackground = registerColor('kt.select.background', { dark: '#00000040', light: '#FFFFFF40', hc: null }, localize('ktSelectBackground', 'Select Background color.'));
export const ktSelectBorder = registerColor('kt.select.border', { dark: '#00000040', light: '#FFFFFF40', hc: null }, localize('ktSelectBorder', 'Select Border color.'));
export const ktSelectPlaceholderForeground = registerColor('kt.select.placeholderForeground', { dark: '#5F656B', light: '#5F656B', hc: null }, localize('ktSelectPlceholder', 'Select Placeholder Foreground color.'));
export const ktSelectDisableBackground = registerColor('kt.select.disableBackground', { dark: '#5F656B40', light: '#5F656B40', hc: null }, localize('ktSelectDisableBackground', 'Select Disable Background color.'));
export const ktSelectDisableForeground = registerColor('kt.select.disableForeground', { dark: '#5F656B', light: '#5F656B', hc: null }, localize('ktSelectDisableForeground', 'Select Disable Foreground color.'));

export const ktSelectOptionActiveBackground = registerColor('selecOption.activeBackground', { dark: '#00000040', light: '#FFFFFF40', hc: null }, localize('ktSelectOptionActiveBackground', 'Select Option Active Background color.'));
export const ktSelectOptionActiveBorder = registerColor('kt.selectOption.activeBorder', { dark: '#167CDB', light: '#167CDB', hc: null }, localize('ktSelectOptionActiveBorder', 'Select Option Active Border color.'));

/* select dropdown */
export const ktSelectDropdownForeground = registerColor('kt.selectDropdown.foreground', { dark: '#D7DBDE', light: '#D7DBDE', hc: null }, localize('ktSelectDropdownForeground', 'Select Dropdown Foreground color.'));
export const ktSelectDropdownBackground = registerColor('kt.selectDropdown.background', { dark: '#35393D', light: '#35393D', hc: null }, localize('ktSelectDropdownBackground', 'Select Dropdown Background color.'));
export const ktSelectDropdownHoverBackground = registerColor('kt.selectDropdown.hoverBackground', { dark: '#5F656B40', light: '#5F656B40', hc: null }, localize('ktSelectDropdownHoverBackground', 'Select Dropdown Hover Background color.'));
export const ktSelectDropdownSelectionBackground = registerColor('kt.selectDropdown.selectionBackground', { dark: '#203E5A', light: '#203E5A', hc: null }, localize('ktSelectDropdownSelectionBackground', 'Select Dropdown Selection Background color.'));
