import { localize } from '@ali/ide-core-common';
import { registerColor, transparent, foreground, TAB_INACTIVE_BACKGROUND, PANEL_BACKGROUND, ACTIVITY_BAR_BACKGROUND, lighten, PANEL_INACTIVE_TITLE_FOREGROUND } from '../../color-registry';
import { EDITOR_GROUP_HEADER_TABS_BACKGROUND } from '../editor';
import { textLinkActiveForeground } from '../text';

/* --- panel --- */
export const ktPanelTitleBackground = registerColor('kt.panelTitle.background', {
  dark: EDITOR_GROUP_HEADER_TABS_BACKGROUND,
  light: EDITOR_GROUP_HEADER_TABS_BACKGROUND,
  hc: EDITOR_GROUP_HEADER_TABS_BACKGROUND,
}, localize('panelTitle.background', 'Panel title background color. Panels are shown below the editor area and contain views like output and integrated terminal.'));

export const ktPanelTabInactiveForeground = registerColor('kt.panelTab.inactiveForeground', {
  dark: transparent(foreground, 0.8),
  light: transparent(foreground, 0.8),
  hc: transparent(foreground, 0.8),
}, localize('panelTab.inactiveForeground', 'Panel tab inactive forground color.'));

export const ktPanelTabActiveForeground = registerColor('kt.panelTab.activeForeground', {
  dark: textLinkActiveForeground,
  light: textLinkActiveForeground,
  hc: textLinkActiveForeground,
}, localize('panelTab.activeForeground', 'Panel tab active forground color.'));

export const ktPanelTabInactiveBackground = registerColor('kt.panelTab.inactiveBackground', {
  dark: TAB_INACTIVE_BACKGROUND,
  light: TAB_INACTIVE_BACKGROUND,
  hc: TAB_INACTIVE_BACKGROUND,
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

export const ktPanelTabActiveBorder = registerColor('kt.panelTab.activeBorder', {
  dark: ACTIVITY_BAR_BACKGROUND,
  light: ACTIVITY_BAR_BACKGROUND,
  hc: ACTIVITY_BAR_BACKGROUND,
}, localize('panelTab.border', 'Panel tab border color.'));

export const ktPanelTabBorder = registerColor('kt.panelTab.border', {
  dark: ACTIVITY_BAR_BACKGROUND,
  light: ACTIVITY_BAR_BACKGROUND,
  hc: ACTIVITY_BAR_BACKGROUND,
}, localize('panelTab.border', 'Panel tab border color.'));

export const ktPanelSecondaryForeground = registerColor('kt.panel.secondaryForeground', {
  dark: lighten(PANEL_INACTIVE_TITLE_FOREGROUND, 0.2),
  light: lighten(PANEL_INACTIVE_TITLE_FOREGROUND, 0.2),
  hc: lighten(PANEL_INACTIVE_TITLE_FOREGROUND, 0.2),
}, localize('panel.secondaryForeground', 'Panel secondary foreground color.'));
