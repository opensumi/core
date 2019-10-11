import { localize } from '@ali/ide-core-common';
import { registerColor, lighten, darken } from '../color-registry';
import { Color } from '../../common/color';

export const buttonForeground = registerColor('button.foreground', { dark: Color.white, light: Color.white, hc: Color.white }, localize('buttonForeground', 'Button foreground color.'));
export const buttonBackground = registerColor('button.background', { dark: '#0E639C', light: '#007ACC', hc: null }, localize('buttonBackground', 'Button background color.'));
export const buttonHoverBackground = registerColor('button.hoverBackground', { dark: lighten(buttonBackground, 0.2), light: darken(buttonBackground, 0.2), hc: null }, localize('buttonHoverBackground', 'Button background color when hovering.'));
