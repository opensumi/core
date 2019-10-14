import { localize } from '@ali/ide-core-common';
import { registerColor } from '../../color-registry';
import { PANEL_BORDER } from '../panel';

// 自定义颜色
export const ktButtonBorder = registerColor('kt.button.border', { dark: PANEL_BORDER, light: PANEL_BORDER, hc: PANEL_BORDER }, localize('buttonBorder', 'Button border color.'));
export const ktPanelClose = registerColor('kt.panel.close', { dark: PANEL_BORDER, light: PANEL_BORDER, hc: PANEL_BORDER }, localize('panelClose', 'Panel close color.'));
