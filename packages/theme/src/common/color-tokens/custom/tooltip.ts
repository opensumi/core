import { localize } from '@ide-framework/ide-core-common';

import { registerColor } from '../../color-registry';
import { NOTIFICATIONS_FOREGROUND, NOTIFICATIONS_BACKGROUND } from '../notification';

/* --- kt tooltip --- */
export const ktTooltipForeground = registerColor('kt.tooltip.foreground', {
  dark: '#D7DBDE',
  light: '#4D4D4D',
  hc: NOTIFICATIONS_FOREGROUND,
}, localize('tooltipForeground', 'Tooltip foreground color. Tooltips when hover a icon or link to show some informations'));

export const ktTooltipBackground = registerColor('kt.tooltip.background', {
  dark: '#35393D',
  light: '#FFFFFF',
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
