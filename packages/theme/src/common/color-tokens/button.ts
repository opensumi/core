import { localize } from '@ali/ide-core-common';
import { registerColor, lighten, darken } from '../color-registry';
import { Color, RGBA } from '../../common/color';

/** default button */
export const buttonForeground = registerColor('button.foreground', { dark: Color.white, light: Color.white, hc: Color.white }, localize('buttonForeground', 'Button foreground color.'));
export const buttonBackground = registerColor('button.background', { dark: '#167CDB', light: '#167CDB', hc: null }, localize('buttonBackground', 'Button background color.'));
export const buttonHoverBackground = registerColor('button.hoverBackground', { dark: '#3892DB', light: '#3892DB', hc: null }, localize('buttonHoverBackground', 'Button background color when hovering.'));
