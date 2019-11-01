import { localize } from '@ali/ide-core-common';
import { registerColor, lighten, darken } from '../../color-registry';
import { PANEL_BORDER, PANEL_BACKGROUND } from '../panel';
import { buttonForeground } from '../button';
import { inputValidationErrorBackground, inputOptionActiveBorder } from '../input';
import { ACTIVITY_BAR_FOREGROUND } from '../activity-bar';
import { NOTIFICATIONS_FOREGROUND, NOTIFICATIONS_BACKGROUND } from '../notification';
import { contrastBorder } from '../base';
import { menuForeground } from '../menu';

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
  dark: PANEL_BACKGROUND,
  light: PANEL_BACKGROUND,
  hc: PANEL_BACKGROUND,
}, localize('panelTitle.background', 'Panel title background color. Panels are shown below the editor area and contain views like output and integrated terminal.'));

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

/* ---  menu --- */
export const menuDescriptionForeground = registerColor('kt.menu.descriptionForeground', { dark: menuForeground, light: menuForeground, hc: menuForeground }, localize('menuDescriptionForeground', 'Description foreground color of menu items.'));
