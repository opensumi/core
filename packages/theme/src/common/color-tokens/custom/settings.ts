import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../../color-registry';
import { PANEL_ACTIVE_TITLE_BORDER, PANEL_ACTIVE_TITLE_FOREGROUND } from '../panel';

export const settingTabActiveBorder = registerColor(
  'kt.settings.tabActiveBorder',
  { dark: PANEL_ACTIVE_TITLE_BORDER, light: PANEL_ACTIVE_TITLE_BORDER, hc: PANEL_ACTIVE_TITLE_BORDER },
  localize(
    'settingsTabActiveBorder',
    'Border on the bottom of an active tab in settings. There can be multiple preference scopes in settings page.',
  ),
);

export const settingTabActiveForeground = registerColor(
  'kt.settings.tabActiveForeground',
  { dark: PANEL_ACTIVE_TITLE_FOREGROUND, light: PANEL_ACTIVE_TITLE_FOREGROUND, hc: PANEL_ACTIVE_TITLE_FOREGROUND },
  localize(
    'settingsTabActiveForeground',
    'Active tab foreground color in an active group in settings. There can be multiple preference scopes in settings page.',
  ),
);
