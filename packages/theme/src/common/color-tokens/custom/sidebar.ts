import { localize } from '@ali/ide-core-common';

import { EDITOR_GROUP_HEADER_TABS_BACKGROUND } from '../editor';
import { registerColor } from '../../color-registry';
import { SIDE_BAR_TITLE_FOREGROUND } from '../sidebar';
import { foreground, descriptionForeground } from '../base';
import { listHoverBackground, listInactiveSelectionBackground } from '../list-tree';

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

export const ktSideBarListForeground = registerColor('kt.sideBarList.foreground', {
  dark: foreground,
  light: foreground,
  hc: foreground,
}, localize('ktSideBarListForeground', 'SideBarList foreground'));

export const ktSideBarListSecondaryForeground = registerColor('kt.sideBarList.secondaryForeground', {
  dark: descriptionForeground,
  light: descriptionForeground,
  hc: descriptionForeground,
}, localize('ktSideBarListSecondaryForeground', 'SideBarList secondary foreground'));

export const ktSideBarListHoverBackground = registerColor('kt.sideBarList.hoverForeground', {
  dark: listHoverBackground,
  light: listHoverBackground,
  hc: listHoverBackground,
}, localize('ktSideBarListHoverBackground', 'SideBarList hover background'));

export const ktSideBarListSelectionBackground = registerColor('kt.sideBarList.selectionBackground', {
  dark: listInactiveSelectionBackground,
  light: listInactiveSelectionBackground,
  hc: listInactiveSelectionBackground,
}, localize('ktSideBarListSelectionBackground', 'SideBarList Select background'));
