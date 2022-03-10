import { localize } from '@opensumi/ide-core-common';

import { Color, RGBA } from '../../common/color';
import { registerColor } from '../color-registry';

import { dropdownBackground, dropdownForeground, dropdownBorder } from './dropdown';
import { editorWidgetBorder } from './editor';
import { inputBackground, inputForeground, inputBorder } from './input';

// Enum control colors
export const settingsSelectBackground = registerColor(
  'settings.dropdownBackground',
  { dark: dropdownBackground, light: dropdownBackground, hc: dropdownBackground },
  localize('settingsDropdownBackground', '(For settings editor preview) Settings editor dropdown background.'),
);
export const settingsSelectForeground = registerColor(
  'settings.dropdownForeground',
  { dark: dropdownForeground, light: dropdownForeground, hc: dropdownForeground },
  localize('settingsDropdownForeground', '(For settings editor preview) Settings editor dropdown foreground.'),
);
export const settingsSelectBorder = registerColor(
  'settings.dropdownBorder',
  { dark: dropdownBorder, light: dropdownBorder, hc: dropdownBorder },
  localize('settingsDropdownBorder', '(For settings editor preview) Settings editor dropdown border.'),
);
export const settingsSelectListBorder = registerColor(
  'settings.dropdownListBorder',
  { dark: editorWidgetBorder, light: editorWidgetBorder, hc: editorWidgetBorder },
  localize(
    'settingsDropdownListBorder',
    '(For settings editor preview) Settings editor dropdown list border. This surrounds the options and separates the options from the description.',
  ),
);

// Bool control colors
export const settingsCheckboxBackground = registerColor(
  'settings.checkboxBackground',
  { dark: dropdownBackground, light: dropdownBackground, hc: dropdownBackground },
  localize('settingsCheckboxBackground', '(For settings editor preview) Settings editor checkbox background.'),
);
export const settingsCheckboxForeground = registerColor(
  'settings.checkboxForeground',
  { dark: dropdownForeground, light: dropdownForeground, hc: dropdownForeground },
  localize('settingsCheckboxForeground', '(For settings editor preview) Settings editor checkbox foreground.'),
);
export const settingsCheckboxBorder = registerColor(
  'settings.checkboxBorder',
  { dark: dropdownBorder, light: dropdownBorder, hc: dropdownBorder },
  localize('settingsCheckboxBorder', '(For settings editor preview) Settings editor checkbox border.'),
);

// Text control colors
export const settingsTextInputBackground = registerColor(
  'settings.textInputBackground',
  { dark: inputBackground, light: inputBackground, hc: inputBackground },
  localize('textInputBoxBackground', '(For settings editor preview) Settings editor text input box background.'),
);
export const settingsTextInputForeground = registerColor(
  'settings.textInputForeground',
  { dark: inputForeground, light: inputForeground, hc: inputForeground },
  localize('textInputBoxForeground', '(For settings editor preview) Settings editor text input box foreground.'),
);
export const settingsTextInputBorder = registerColor(
  'settings.textInputBorder',
  { dark: inputBorder, light: inputBorder, hc: inputBorder },
  localize('textInputBoxBorder', '(For settings editor preview) Settings editor text input box border.'),
);

// Number control colors
export const settingsNumberInputBackground = registerColor(
  'settings.numberInputBackground',
  { dark: inputBackground, light: inputBackground, hc: inputBackground },
  localize('numberInputBoxBackground', '(For settings editor preview) Settings editor number input box background.'),
);
export const settingsNumberInputForeground = registerColor(
  'settings.numberInputForeground',
  { dark: inputForeground, light: inputForeground, hc: inputForeground },
  localize('numberInputBoxForeground', '(For settings editor preview) Settings editor number input box foreground.'),
);
export const settingsNumberInputBorder = registerColor(
  'settings.numberInputBorder',
  { dark: inputBorder, light: inputBorder, hc: inputBorder },
  localize('numberInputBoxBorder', '(For settings editor preview) Settings editor number input box border.'),
);

export const settingsHeaderForeground = registerColor(
  'settings.headerForeground',
  { light: '#444444', dark: '#e7e7e7', hc: '#ffffff' },
  localize(
    'headerForeground',
    '(For settings editor preview) The foreground color for a section header or active title.',
  ),
);

export const modifiedItemIndicator = registerColor(
  'settings.modifiedItemIndicator',
  {
    light: new Color(new RGBA(102, 175, 224)),
    dark: new Color(new RGBA(12, 125, 157)),
    hc: new Color(new RGBA(0, 73, 122)),
  },
  localize('modifiedItemForeground', '(For settings editor preview) The color of the modified setting indicator.'),
);
