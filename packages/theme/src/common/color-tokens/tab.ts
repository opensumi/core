import { localize } from '@opensumi/ide-core-common';

import { Color } from '../../common/color';
import { transparent, registerColor } from '../utils';

import { contrastBorder } from './base';
import { hcActiveBorderColor, hcBorderColor } from './basic-color';
import { editorBackground } from './editor';
import { treeIndentGuidesStroke } from './list-tree';

// < --- Tabs --- >

export const TAB_ACTIVE_BACKGROUND = registerColor(
  'tab.activeBackground',
  {
    dark: editorBackground,
    light: editorBackground,
    hcDark: editorBackground,
    hcLight: editorBackground,
  },
  localize(
    'tabActiveBackground',
    'Active tab background color in an active group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_UNFOCUSED_ACTIVE_BACKGROUND = registerColor(
  'tab.unfocusedActiveBackground',
  {
    dark: TAB_ACTIVE_BACKGROUND,
    light: TAB_ACTIVE_BACKGROUND,
    hcDark: TAB_ACTIVE_BACKGROUND,
    hcLight: TAB_ACTIVE_BACKGROUND,
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
    hcDark: TAB_UNFOCUSED_ACTIVE_BACKGROUND,
    hcLight: TAB_UNFOCUSED_ACTIVE_BACKGROUND,
  },
  localize(
    'tabInactiveBackground',
    'Inactive tab background color in an active group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_UNFOCUSED_INACTIVE_BACKGROUND = registerColor(
  'tab.unfocusedInactiveBackground',
  {
    dark: TAB_INACTIVE_BACKGROUND,
    light: TAB_INACTIVE_BACKGROUND,
    hcDark: TAB_INACTIVE_BACKGROUND,
    hcLight: TAB_INACTIVE_BACKGROUND,
  },
  localize(
    'tabUnfocusedInactiveBackground',
    'Inactive tab background color in an unfocused group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_HOVER_BACKGROUND = registerColor(
  'tab.hoverBackground',
  {
    dark: null,
    light: null,
    hcDark: null,
    hcLight: null,
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
    hcDark: null,
    hcLight: null,
  },
  localize(
    'tabUnfocusedHoverBackground',
    'Tab background color in an unfocused group when hovering. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_HOVER_FOREGROUND = registerColor(
  'tab.hoverForeground',
  {
    dark: null,
    light: null,
    hcDark: null,
    hcLight: null,
  },
  localize(
    'tabHoverForeground',
    'Tab foreground color when hovering. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_UNFOCUSED_HOVER_FOREGROUND = registerColor(
  'tab.unfocusedHoverForeground',
  {
    dark: transparent(TAB_HOVER_FOREGROUND, 0.5),
    light: transparent(TAB_HOVER_FOREGROUND, 0.5),
    hcDark: null,
    hcLight: null,
  },
  localize(
    'tabUnfocusedHoverForeground',
    'Tab foreground color in an unfocused group when hovering. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_BORDER = registerColor(
  'tab.border',
  {
    dark: '#252526',
    light: '#F3F3F3',
    hcDark: contrastBorder,
    hcLight: contrastBorder,
  },
  localize(
    'tabBorder',
    'Border to separate tabs from each other. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_LAST_PINNED_BORDER = registerColor(
  'tab.lastPinnedBorder',
  {
    dark: treeIndentGuidesStroke,
    light: treeIndentGuidesStroke,
    hcDark: contrastBorder,
    hcLight: contrastBorder,
  },
  localize(
    'lastPinnedTabBorder',
    'Border to separate pinned tabs from other tabs. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_ACTIVE_BORDER = registerColor(
  'tab.activeBorder',
  {
    dark: null,
    light: null,
    hcDark: null,
    hcLight: null,
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
    hcDark: null,
    hcLight: null,
  },
  localize(
    'tabActiveUnfocusedBorder',
    'Border on the bottom of an active tab in an unfocused group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_ACTIVE_BORDER_TOP = registerColor(
  'tab.activeBorderTop',
  {
    dark: null,
    light: null,
    hcDark: null,
    hcLight: '#B5200D',
  },
  localize(
    'tabActiveBorderTop',
    'Border to the top of an active tab. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_UNFOCUSED_ACTIVE_BORDER_TOP = registerColor(
  'tab.unfocusedActiveBorderTop',
  {
    dark: transparent(TAB_ACTIVE_BORDER_TOP, 0.5),
    light: transparent(TAB_ACTIVE_BORDER_TOP, 0.7),
    hcDark: null,
    hcLight: '#B5200D',
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
    hcDark: null,
    hcLight: contrastBorder,
  },
  localize(
    'tabActiveModifiedBorder',
    'Border on the top of modified active tabs in an active group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_INACTIVE_MODIFIED_BORDER = registerColor(
  'tab.inactiveModifiedBorder',
  {
    dark: transparent(TAB_ACTIVE_MODIFIED_BORDER, 0.5),
    light: transparent(TAB_ACTIVE_MODIFIED_BORDER, 0.5),
    hcDark: Color.white,
    hcLight: contrastBorder,
  },
  localize(
    'tabInactiveModifiedBorder',
    'Border on the top of modified inactive tabs in an active group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_UNFOCUSED_ACTIVE_MODIFIED_BORDER = registerColor(
  'tab.unfocusedActiveModifiedBorder',
  {
    dark: transparent(TAB_ACTIVE_MODIFIED_BORDER, 0.5),
    light: transparent(TAB_ACTIVE_MODIFIED_BORDER, 0.7),
    hcDark: Color.white,
    hcLight: contrastBorder,
  },
  localize(
    'unfocusedActiveModifiedBorder',
    'Border on the top of modified active tabs in an unfocused group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);

export const TAB_UNFOCUSED_INACTIVE_MODIFIED_BORDER = registerColor(
  'tab.unfocusedInactiveModifiedBorder',
  {
    dark: transparent(TAB_INACTIVE_MODIFIED_BORDER, 0.5),
    light: transparent(TAB_INACTIVE_MODIFIED_BORDER, 0.5),
    hcDark: Color.white,
    hcLight: contrastBorder,
  },
  localize(
    'unfocusedINactiveModifiedBorder',
    'Border on the top of modified inactive tabs in an unfocused group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);
export const TAB_HOVER_BORDER = registerColor(
  'tab.hoverBorder',
  {
    dark: null,
    light: null,
    hcDark: null,
    hcLight: null,
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
    hcDark: null,
    hcLight: contrastBorder,
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
    hcDark: hcActiveBorderColor,
    hcLight: hcActiveBorderColor,
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
    hcDark: Color.white,
    hcLight: '#292929',
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
    hcDark: Color.white,
    hcLight: '#292929',
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
    hcDark: Color.white,
    hcLight: '#292929',
  },
  localize(
    'tabUnfocusedInactiveForeground',
    'Inactive tab foreground color in an unfocused group. Tabs are the containers for editors in the editor area. Multiple tabs can be opened in one editor group. There can be multiple editor groups.',
  ),
);
