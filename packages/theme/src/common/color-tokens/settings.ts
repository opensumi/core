import { localize } from '@opensumi/ide-core-common';

import { Color, RGBA } from '../../common/color';
import { registerColor, transparent } from '../utils';

import { checkboxBackground, checkboxBorder, checkboxForeground } from './checkbox';
import { selectBackground, selectBorder, selectForeground } from './dropdown';
import { editorWidgetBorder } from './editor';
import { inputBackground, inputBorder, inputForeground } from './input';
import { listHoverBackground } from './list-tree';
import { PANEL_BORDER } from './panel';

// Enum control colors
export const settingsSelectBackground = registerColor(
  'settings.dropdownBackground',
  { dark: selectBackground, light: selectBackground, hcDark: selectBackground, hcLight: selectBackground },
  localize('settingsDropdownBackground', 'Settings editor dropdown background.'),
);
export const settingsSelectForeground = registerColor(
  'settings.dropdownForeground',
  { dark: selectForeground, light: selectForeground, hcDark: selectForeground, hcLight: selectForeground },
  localize('settingsDropdownForeground', 'Settings editor dropdown foreground.'),
);
export const settingsSelectBorder = registerColor(
  'settings.dropdownBorder',
  { dark: selectBorder, light: selectBorder, hcDark: selectBorder, hcLight: selectBorder },
  localize('settingsDropdownBorder', 'Settings editor dropdown border.'),
);
export const settingsSelectListBorder = registerColor(
  'settings.dropdownListBorder',
  { dark: editorWidgetBorder, light: editorWidgetBorder, hcDark: editorWidgetBorder, hcLight: editorWidgetBorder },
  localize(
    'settingsDropdownListBorder',
    'Settings editor dropdown list border. This surrounds the options and separates the options from the description.',
  ),
);

// Bool control colors
export const settingsCheckboxBackground = registerColor(
  'settings.checkboxBackground',
  { dark: checkboxBackground, light: checkboxBackground, hcDark: checkboxBackground, hcLight: checkboxBackground },
  localize('settingsCheckboxBackground', 'Settings editor checkbox background.'),
);
export const settingsCheckboxForeground = registerColor(
  'settings.checkboxForeground',
  { dark: checkboxForeground, light: checkboxForeground, hcDark: checkboxForeground, hcLight: checkboxForeground },
  localize('settingsCheckboxForeground', 'Settings editor checkbox foreground.'),
);
export const settingsCheckboxBorder = registerColor(
  'settings.checkboxBorder',
  { dark: checkboxBorder, light: checkboxBorder, hcDark: checkboxBorder, hcLight: checkboxBorder },
  localize('settingsCheckboxBorder', 'Settings editor checkbox border.'),
);

// Text control colors
export const settingsTextInputBackground = registerColor(
  'settings.textInputBackground',
  { dark: inputBackground, light: inputBackground, hcDark: inputBackground, hcLight: inputBackground },
  localize('textInputBoxBackground', 'Settings editor text input box background.'),
);
export const settingsTextInputForeground = registerColor(
  'settings.textInputForeground',
  { dark: inputForeground, light: inputForeground, hcDark: inputForeground, hcLight: inputForeground },
  localize('textInputBoxForeground', 'Settings editor text input box foreground.'),
);
export const settingsTextInputBorder = registerColor(
  'settings.textInputBorder',
  { dark: inputBorder, light: inputBorder, hcDark: inputBorder, hcLight: inputBorder },
  localize('textInputBoxBorder', 'Settings editor text input box border.'),
);

// Number control colors
export const settingsNumberInputBackground = registerColor(
  'settings.numberInputBackground',
  { dark: inputBackground, light: inputBackground, hcDark: inputBackground, hcLight: inputBackground },
  localize('numberInputBoxBackground', 'Settings editor number input box background.'),
);
export const settingsNumberInputForeground = registerColor(
  'settings.numberInputForeground',
  { dark: inputForeground, light: inputForeground, hcDark: inputForeground, hcLight: inputForeground },
  localize('numberInputBoxForeground', 'Settings editor number input box foreground.'),
);
export const settingsNumberInputBorder = registerColor(
  'settings.numberInputBorder',
  { dark: inputBorder, light: inputBorder, hcDark: inputBorder, hcLight: inputBorder },
  localize('numberInputBoxBorder', 'Settings editor number input box border.'),
);

export const focusedRowBackground = registerColor(
  'settings.focusedRowBackground',
  {
    dark: transparent(listHoverBackground, 0.6),
    light: transparent(listHoverBackground, 0.6),
    hcDark: null,
    hcLight: null,
  },
  localize('focusedRowBackground', 'The background color of a settings row when focused.'),
);

export const settingsHeaderForeground = registerColor(
  'settings.headerForeground',
  { light: '#444444', dark: '#e7e7e7', hcDark: '#ffffff', hcLight: '#292929' },
  localize('headerForeground', 'The foreground color for a section header or active title.'),
);

export const modifiedItemIndicator = registerColor(
  'settings.modifiedItemIndicator',
  {
    light: new Color(new RGBA(102, 175, 224)),
    dark: new Color(new RGBA(12, 125, 157)),
    hcDark: new Color(new RGBA(0, 73, 122)),
    hcLight: new Color(new RGBA(102, 175, 224)),
  },
  localize('modifiedItemForeground', 'The color of the modified setting indicator.'),
);

export const settingsHeaderBorder = registerColor(
  'settings.headerBorder',
  { dark: PANEL_BORDER, light: PANEL_BORDER, hcDark: PANEL_BORDER, hcLight: PANEL_BORDER },
  localize('settingsHeaderBorder', 'The color of the header container border.'),
);
export const settingsSashBorder = registerColor(
  'settings.sashBorder',
  { dark: PANEL_BORDER, light: PANEL_BORDER, hcDark: PANEL_BORDER, hcLight: PANEL_BORDER },
  localize('settingsSashBorder', 'The color of the Settings editor splitview sash border.'),
);
