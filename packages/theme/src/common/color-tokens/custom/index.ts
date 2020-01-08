import { localize } from '@ali/ide-core-common';
import { registerColor, lighten, darken, transparent } from '../../color-registry';
import { PANEL_BORDER, PANEL_BACKGROUND, PANEL_INACTIVE_TITLE_FOREGROUND } from '../panel';
import { buttonForeground } from '../button';
import { inputValidationErrorBackground, inputOptionActiveBorder } from '../input';
import { ACTIVITY_BAR_FOREGROUND, ACTIVITY_BAR_BACKGROUND, ACTIVITY_BAR_BORDER } from '../activity-bar';
import { NOTIFICATIONS_FOREGROUND, NOTIFICATIONS_BACKGROUND } from '../notification';
import { contrastBorder, foreground, widgetShadow, descriptionForeground } from '../base';
import { menuForeground } from '../menu';
import { SIDE_BAR_TITLE_FOREGROUND } from '../sidebar';
import { listHoverBackground, listInactiveSelectionBackground } from '../list-tree';
import { EDITOR_GROUP_HEADER_TABS_BACKGROUND } from '../editor';

// components
export * from './button';
export * from './input';
export * from './checkbox';
export * from './select';
export * from './modal';
export * from './icon';
// blocks
export * from './actionbar';

// 自定义颜色

/* --- button --- */
// @deprecated
export const ktButtonBorder = registerColor('kt.button.border', { dark: PANEL_BORDER, light: PANEL_BORDER, hc: PANEL_BORDER }, localize('ButtonBorder', 'Button border color.'));

// 这两个值即是 color 也是 border color
export const ktSecondaryButtonForeground = registerColor('kt.secondary.button.foreground', { dark: buttonForeground, light: buttonForeground, hc: buttonForeground }, localize('secondaryButtonForeground', 'Secondary button foreground color.'));
export const ktSecondaryButtonBorder = registerColor('kt.secondary.button.border', { dark: buttonForeground, light: buttonForeground, hc: buttonForeground }, localize('secondaryButtonBorder', 'Secondary button border color.'));
export const ktSecondaryButtonHoverForeground = registerColor('kt.secondary.button.hoverForeground', { dark: ACTIVITY_BAR_FOREGROUND, light: ACTIVITY_BAR_FOREGROUND, hc: null }, localize('buttonHoverBackground', 'Secondary button background color when hovering.'));

export const ktDangerButtonForeground = registerColor('kt.danger.button.foreground', { dark: buttonForeground, light: buttonForeground, hc: buttonForeground }, localize('dangerButtonForeground', 'Danger button foreground color.'));
export const ktDangerButtonBackground = registerColor(
  'kt.danger.button.background',
  { dark: inputValidationErrorBackground, light: inputValidationErrorBackground, hc: null },
  localize('dangerButtonBackground', 'Danger button background color.'),
);
export const ktDangerButtonHoverBackground = registerColor('kt.danger.button.hoverBackground', { dark: lighten(inputValidationErrorBackground, 0.2), light: darken(inputValidationErrorBackground, 0.2), hc: null }, localize('dangerButtonHoverBackground', 'Danger button background color when hovering.'));

/* --- notification --- */
export const ktNotificationsInfoIcon = registerColor('kt.notificationsCloseIcon.foreground', { dark: NOTIFICATIONS_FOREGROUND, light: NOTIFICATIONS_FOREGROUND, hc: NOTIFICATIONS_FOREGROUND }, localize('notificationCloseIconForeground', 'Notification close icon foreground.'));

/* --- panel --- */
export const ktPanelTitleBackground = registerColor('kt.panelTitle.background', {
  dark: ACTIVITY_BAR_BACKGROUND,
  light: ACTIVITY_BAR_BACKGROUND,
  hc: ACTIVITY_BAR_BACKGROUND,
}, localize('panelTitle.background', 'Panel title background color. Panels are shown below the editor area and contain views like output and integrated terminal.'));

export const ktPanelTabInactiveForeground = registerColor('kt.panelTab.inactiveForeground', {
  dark: transparent(foreground, 0.8),
  light: transparent(foreground, 0.8),
  hc: transparent(foreground, 0.8),
}, localize('panelTab.inactiveForeground', 'Panel tab inactive forground color.'));

export const ktPanelTabActiveForeground = registerColor('kt.panelTab.activeForeground', {
  dark: foreground,
  light: foreground,
  hc: foreground,
}, localize('panelTab.activeForeground', 'Panel tab active forground color.'));

export const ktPanelTabInactiveBackground = registerColor('kt.panelTab.inactiveBackground', {
  dark: ACTIVITY_BAR_BACKGROUND,
  light: ACTIVITY_BAR_BACKGROUND,
  hc: ACTIVITY_BAR_BACKGROUND,
}, localize('panelTab.inactiveBackground', 'Panel tab background color.'));

export const ktPanelTabActiveBackground = registerColor('kt.panelTab.activeBackground', {
  dark: PANEL_BACKGROUND,
  light: PANEL_BACKGROUND,
  hc: PANEL_BACKGROUND,
}, localize('panelTab.activeBackground', 'Panel tab active background color.'));

export const ktPanelTabActionIconForeground = registerColor('kt.panelTabActionIcon.foreground', {
  dark: foreground,
  light: foreground,
  hc: foreground,
}, localize('panelTabActionIcon.foreground', 'Panel tab close icon color.'));

export const ktPanelTabBorder = registerColor('kt.panelTab.border', {
  dark: ACTIVITY_BAR_BACKGROUND,
  light: ACTIVITY_BAR_BACKGROUND,
  hc: ACTIVITY_BAR_BACKGROUND,
}, localize('panelTab.border', 'Panel tab border color.'));

export const ktPanelSecondaryForeground = registerColor('kt.panel.secondaryForeground', {
  dark: lighten(PANEL_INACTIVE_TITLE_FOREGROUND, 0.2),
  light: lighten(PANEL_INACTIVE_TITLE_FOREGROUND, 0.2),
  hc: lighten(PANEL_INACTIVE_TITLE_FOREGROUND, 0.2),
}, localize('panel.secondaryForeground', 'Panel sccondary foreground color.'));

/* --- input --- */
export const ktInputOptionHoverBorder = registerColor('kt.inputOption.hoverBorder', {
  dark: inputOptionActiveBorder,
  light: inputOptionActiveBorder,
  hc: contrastBorder,
}, localize('inputOptionHoverBorder', 'Border color of hovering options in input fields.'));

/* --- kt tooltip --- */
export const ktTooltipForeground = registerColor('kt.tooltip.foreground', {
  dark: NOTIFICATIONS_FOREGROUND,
  light: NOTIFICATIONS_FOREGROUND,
  hc: NOTIFICATIONS_FOREGROUND,
}, localize('tooltipForeground', 'Tooltip foreground color. Tooltips when hover a icon or link to show some informations'));

export const ktTooltipBackground = registerColor('kt.tooltip.background', {
  dark: NOTIFICATIONS_BACKGROUND,
  light: NOTIFICATIONS_BACKGROUND,
  hc: NOTIFICATIONS_BACKGROUND,
}, localize('tooltipBackground', 'Tooltip background color. Tooltips when hover a icon or link to show some informations'));

export const ktEditorActionToolTipBackground = registerColor('kt.editorActionToolTip.background', {
  dark: ktTooltipBackground,
  light: ktTooltipBackground,
  hc: ktTooltipBackground,
}, localize('editorActionTooltipBackground', 'Tooltip background color for Editor Actions Tip'));

export const ktEditorActionToolTipForeground = registerColor('kt.editorActionToolTip.foreground', {
  dark: ktTooltipForeground,
  light: ktTooltipForeground,
  hc: ktTooltipForeground,
}, localize('editorActionTooltipForeground', 'Tooltip Foreground color for Editor Actions Tip'));

// 断网是状态栏用的颜色
// 没有很好的 backup token，先写死这个色值
export const ktStatusBarOfflineBackground = registerColor('kt.statusbar.offline.background', {
  dark: '#D21F28',
  light: '#D21F28',
  hc: '#D21F28',
}, localize('statusBarOfflineBackground', 'StatusBar background color when app is offline'));

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

export const ktSideBarSectionHeaderArrowForeground = registerColor('kt.sideBarSectionHeaderArrow.foreground', {
  dark: foreground,
  light: foreground,
  hc: foreground,
}, localize('ktSideBarSectionHeaderArrowForeground', 'SideBar section header arrow color'));

/* ---  menu --- */
export const menuDescriptionForeground = registerColor(
  'kt.menu.descriptionForeground',
  { dark: menuForeground, light: menuForeground, hc: menuForeground },
  localize('menuDescriptionForeground', 'Description foreground color of menu items.'),
);

export const menuDisableForeground = registerColor(
  'kt.menu.disableForeground',
  {
    dark: transparent(menuForeground, 0.3),
    light: transparent(menuForeground, 0.3),
    hc: transparent(menuForeground, 0.3),
  },
  localize('menuDisableForeground', 'Foreground color of disabled menu items.'),
);

export const menuShadow = registerColor(
  'kt.menu.shadow',
  { dark: widgetShadow, light: widgetShadow, hc: widgetShadow },
  localize('menuShadow', 'Box shadow color of menu.'),
);

/* --- menubar --- */
export const menubarForeground = registerColor(
  'kt.menubar.foreground',
  { dark: foreground, light: foreground, hc: foreground },
  localize('menubarForeground', 'Foreground color of menu bar.'),
);

export const menubarBackground = registerColor(
  'kt.menubar.background',
  { dark: null, light: null, hc: null },
  localize('menubarBackground', 'Background color of menu bar.'),
);

export const menubarSeparatorBackground = registerColor(
  'kt.menubar.separatorBackground',
  { dark: null, light: null, hc: null },
  localize('menubarSeparatorBackground', 'Separator background of menu bar.'),
);

export const menubarBorder = registerColor(
  'kt.menubar.border',
  { dark: ACTIVITY_BAR_BORDER, light: ACTIVITY_BAR_BORDER, hc: ACTIVITY_BAR_BORDER },
  localize('menubarBorder', 'Border color of menu bar.'),
);
