import { localize } from '@ali/ide-core-common';

import { EDITOR_GROUP_HEADER_TABS_BACKGROUND } from '../editor';
import { registerColor } from '../../color-registry';
import { SIDE_BAR_TITLE_FOREGROUND } from '../sidebar';

export const ktSideBarTitleBorder = registerColor('kt.sideBarTitle.border', {
  dark: EDITOR_GROUP_HEADER_TABS_BACKGROUND,
  light: EDITOR_GROUP_HEADER_TABS_BACKGROUND,
  hc: EDITOR_GROUP_HEADER_TABS_BACKGROUND,
}, localize('sideBarTitleBorder', 'SideBar title border color when active'));

export const ktSideBarTitleActiveBorder = registerColor('kt.sideBarTitle.activeBorder', {
  dark: SIDE_BAR_TITLE_FOREGROUND,
  light: SIDE_BAR_TITLE_FOREGROUND,
  hc: SIDE_BAR_TITLE_FOREGROUND,
}, localize('sideBarTitleActiveBorder', 'SideBar title border color when active'));
