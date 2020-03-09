import { localize } from '@ali/ide-core-common';
import { registerColor, lighten, darken } from '../../color-registry';
import { buttonForeground } from '../button';
import { inputValidationErrorBackground } from '../input';
import { ACTIVITY_BAR_FOREGROUND } from '../activity-bar';

// base
export * from './base';

// components
export * from './button';
export * from './input';
export * from './checkbox';
export * from './select';
export * from './modal';
export * from './icon';
export * from './editor';
export * from './badge';
export * from './tab';
export * from './tree';

// blocks
export * from './actionbar';
export * from './activity-bar';
export * from './menu';
export * from './notification';
export * from './panel';
export * from './settings';
export * from './sidebar';
export * from './statusbar';

// WARNING: 自定义颜色请放到独立文件中，不要继续往这个文件添加了

/* --- button --- */
// @deprecated 待 core-browser/components 被删除后即可移除
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

// WARNING: 自定义颜色请放到独立文件中，不要继续往这个文件添加了
