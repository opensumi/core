import { localize } from '@opensumi/ide-core-common';

import { registerColor, transparent } from '../../utils';
import { foreground } from '../base';
import { inputActiveOptionBackground, inputActiveOptionBorder } from '../input';

// action bar
export const actionbarForeground = registerColor(
  'kt.actionbar.foreground',
  { dark: foreground, light: foreground, hcDark: foreground, hcLight: foreground },
  localize('actionbarForeground', 'Foreground color of icon in actionbar'),
);

export const actionbarDisableForeground = registerColor(
  'kt.actionbar.disableForeground',
  {
    dark: transparent(foreground, 0.3),
    light: transparent(foreground, 0.3),
    hcDark: transparent(foreground, 0.3),
    hcLight: transparent(foreground, 0.3),
  },
  localize('actionbarDisableForeground', 'Foreground color of disabled icon in actionbar'),
);

export const actionBarSeparatorBg = registerColor(
  'kt.actionbar.separatorBackground',
  { dark: null, light: null, hcDark: null, hcLight: null },
  localize('actionbarSeparatorBackground', 'Separator background color of actionbar'),
);

export const actionbarSelectionBackground = registerColor(
  'kt.actionbar.selectionBackground',
  {
    dark: inputActiveOptionBackground,
    light: inputActiveOptionBackground,
    hcDark: inputActiveOptionBackground,
    hcLight: inputActiveOptionBackground,
  },
  localize('actionbarSelectionBackground', 'Bacjground color of selected icon in actionbar'),
);

export const actionbarSelectionBorder = registerColor(
  'kt.actionbar.selectionBorder',
  {
    dark: inputActiveOptionBorder,
    light: inputActiveOptionBorder,
    hcDark: inputActiveOptionBorder,
    hcLight: inputActiveOptionBorder,
  },
  localize('actionbarSelectionBorder', 'Border color of selected icon in actionbar'),
);
