import { localize } from '@opensumi/ide-core-common';

import { registerColor, transparent } from '../../color-registry';
import { foreground } from '../base';
import { inputOptionActiveBorder, inputOptionActiveBackground } from '../input';

// action bar
export const actionbarForeground = registerColor(
  'kt.actionbar.foreground',
  { dark: foreground, light: foreground, hc: foreground },
  localize('actionbarForeground', 'Foreground color of icon in actionbar'),
);

export const actionbarDisableForeground = registerColor(
  'kt.actionbar.disableForeground',
  {
    dark: transparent(foreground, 0.3),
    light: transparent(foreground, 0.3),
    hc: transparent(foreground, 0.3),
  },
  localize('actionbarDisableForeground', 'Foreground color of disabled icon in actionbar'),
);

export const actionBarSeparatorBg = registerColor(
  'kt.actionbar.separatorBackground',
  { dark: null, light: null, hc: null },
  localize('actionbarSeparatorBackground', 'Separator background color of actionbar'),
);

export const actionbarSelectionBackground = registerColor(
  'kt.actionbar.selectionBackground',
  { dark: inputOptionActiveBackground, light: inputOptionActiveBackground, hc: inputOptionActiveBackground },
  localize('actionbarSelectionBackground', 'Bacjground color of selected icon in actionbar'),
);

export const actionbarSelectionBorder = registerColor(
  'kt.actionbar.selectionBorder',
  { dark: inputOptionActiveBorder, light: inputOptionActiveBorder, hc: inputOptionActiveBorder },
  localize('actionbarSelectionBorder', 'Border color of selected icon in actionbar'),
);
