import { localize } from '@opensumi/ide-core-common';

import { Color } from '../../common/color';
import { registerColor, transparent } from '../color-registry';

import { contrastBorder } from './base';
import { hcActiveBorderColor, hcBorderColor } from './basic-color';
import { editorBackground } from './editor';

// < --- Tabs --- >

export const TAB_ACTIVE_BACKGROUND = registerColor(
  'tab.activeBackground',
  {
    dark: editorBackground,
    light: editorBackground,
    hc: editorBackground,
  },
  localize(
    'tabActiveBackground',
    'Active tab background color. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_UNFOCUSED_ACTIVE_BACKGROUND = registerColor(
  'tab.unfocusedActiveBackground',
  {
    dark: TAB_ACTIVE_BACKGROUND,
    light: TAB_ACTIVE_BACKGROUND,
    hc: TAB_ACTIVE_BACKGROUND,
  },
  localize(
    'tabUnfocusedActiveBackground',
    'Active tab background color in an unfocused group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_INACTIVE_BACKGROUND = registerColor(
  'tab.inactiveBackground',
  {
    dark: '#2D2D2D',
    light: '#ECECEC',
    hc: null,
  },
  localize(
    'tabInactiveBackground',
    'Inactive tab background color. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_HOVER_BACKGROUND = registerColor(
  'tab.hoverBackground',
  {
    dark: null,
    light: null,
    hc: null,
  },
  localize(
    'tabHoverBackground',
    'Tab background color when hovering. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_UNFOCUSED_HOVER_BACKGROUND = registerColor(
  'tab.unfocusedHoverBackground',
  {
    dark: transparent(TAB_HOVER_BACKGROUND, 0.5),
    light: transparent(TAB_HOVER_BACKGROUND, 0.7),
    hc: null,
  },
  localize(
    'tabUnfocusedHoverBackground',
    'Tab background color in an unfocused group when hovering. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_BORDER = registerColor(
  'tab.border',
  {
    dark: '#252526',
    light: '#F3F3F3',
    hc: contrastBorder,
  },
  localize(
    'tabBorder',
    'Border to separate tabs from each other. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_ACTIVE_BORDER = registerColor(
  'tab.activeBorder',
  {
    dark: editorBackground,
    light: editorBackground,
    hc: contrastBorder,
  },
  localize(
    'tabActiveBorder',
    'Border on the bottom of an active tab. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_UNFOCUSED_ACTIVE_BORDER = registerColor(
  'tab.unfocusedActiveBorder',
  {
    dark: transparent(TAB_ACTIVE_BORDER, 0.5),
    light: transparent(TAB_ACTIVE_BORDER, 0.7),
    hc: null,
  },
  localize(
    'tabActiveUnfocusedBorder',
    'Border on the bottom of an active tab in an unfocused group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_ACTIVE_BORDER_TOP = registerColor(
  'tab.activeBorderTop',
  {
    dark: 'transparent',
    light: 'transparent',
    hc: '#000000',
  },
  localize(
    'tabActiveBorderTop',
    'Border to the top of an active tab. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_UNFOCUSED_ACTIVE_BORDER_TOP = registerColor(
  'tab.unfocusedActiveBorderTop',
  {
    dark: 'transparent',
    light: 'transparent',
    hc: null,
  },
  localize(
    'tabActiveUnfocusedBorderTop',
    'Border to the top of an active tab in an unfocused group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_ACTIVE_MODIFIED_BORDER = registerColor(
  'tab.activeModifiedBorder',
  {
    dark: '#3399CC',
    light: '#33AAEE',
    hc: null,
  },
  localize(
    'tabActiveModifiedBorder',
    'Border on the top of modified (dirty) active tabs in an active group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_INACTIVE_MODIFIED_BORDER = registerColor(
  'tab.inactiveModifiedBorder',
  {
    dark: transparent(TAB_ACTIVE_MODIFIED_BORDER, 0.5),
    light: transparent(TAB_ACTIVE_MODIFIED_BORDER, 0.5),
    hc: Color.white,
  },
  localize(
    'tabInactiveModifiedBorder',
    'Border on the top of modified (dirty) inactive tabs in an active group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_UNFOCUSED_ACTIVE_MODIFIED_BORDER = registerColor(
  'tab.unfocusedActiveModifiedBorder',
  {
    dark: transparent(TAB_ACTIVE_MODIFIED_BORDER, 0.5),
    light: transparent(TAB_ACTIVE_MODIFIED_BORDER, 0.7),
    hc: Color.white,
  },
  localize(
    'unfocusedActiveModifiedBorder',
    'Border on the top of modified (dirty) active tabs in an unfocused group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_UNFOCUSED_INACTIVE_MODIFIED_BORDER = registerColor(
  'tab.unfocusedInactiveModifiedBorder',
  {
    dark: transparent(TAB_INACTIVE_MODIFIED_BORDER, 0.5),
    light: transparent(TAB_INACTIVE_MODIFIED_BORDER, 0.5),
    hc: Color.white,
  },
  localize(
    'unfocusedINactiveModifiedBorder',
    'Border on the top of modified (dirty) inactive tabs in an unfocused group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_HOVER_BORDER = registerColor(
  'tab.hoverBorder',
  {
    dark: '#00000000',
    light: '#00000000',
    hc: hcBorderColor,
  },
  localize(
    'tabHoverBorder',
    'Border to highlight tabs when hovering. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_UNFOCUSED_HOVER_BORDER = registerColor(
  'tab.unfocusedHoverBorder',
  {
    dark: transparent(TAB_HOVER_BORDER, 0.5),
    light: transparent(TAB_HOVER_BORDER, 0.7),
    hc: null,
  },
  localize(
    'tabUnfocusedHoverBorder',
    'Border to highlight tabs in an unfocused group when hovering. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_ACTIVE_FOREGROUND = registerColor(
  'tab.activeForeground',
  {
    dark: Color.white,
    light: '#333333',
    hc: hcActiveBorderColor,
  },
  localize(
    'tabActiveForeground',
    'Active tab foreground color in an active group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_INACTIVE_FOREGROUND = registerColor(
  'tab.inactiveForeground',
  {
    dark: transparent(TAB_ACTIVE_FOREGROUND, 0.5),
    light: transparent(TAB_ACTIVE_FOREGROUND, 0.7),
    hc: Color.white,
  },
  localize(
    'tabInactiveForeground',
    'Inactive tab foreground color in an active group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_UNFOCUSED_ACTIVE_FOREGROUND = registerColor(
  'tab.unfocusedActiveForeground',
  {
    dark: transparent(TAB_ACTIVE_FOREGROUND, 0.5),
    light: transparent(TAB_ACTIVE_FOREGROUND, 0.7),
    hc: Color.white,
  },
  localize(
    'tabUnfocusedActiveForeground',
    'Active tab foreground color in an unfocused group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_UNFOCUSED_INACTIVE_FOREGROUND = registerColor(
  'tab.unfocusedInactiveForeground',
  {
    dark: transparent(TAB_INACTIVE_FOREGROUND, 0.5),
    light: transparent(TAB_INACTIVE_FOREGROUND, 0.5),
    hc: Color.white,
  },
  localize(
    'tabUnfocusedInactiveForeground',
    'Inactive tab foreground color in an unfocused group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const EDITOR_GROUP_HEADER_TABS_BORDER = registerColor(
  'editorGroupHeader.tabsBorder',
  {
    dark: TAB_INACTIVE_BACKGROUND,
    light: TAB_INACTIVE_BACKGROUND,
    hc: TAB_INACTIVE_BACKGROUND,
  },
  localize(
    'tabsContainerBorder',
    'Border color of the editor group title header when tabs are enabled. Editor groups are the containers of editors.',
  ),
);
