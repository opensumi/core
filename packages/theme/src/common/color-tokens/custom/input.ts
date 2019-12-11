import { localize } from '@ali/ide-core-common';
import { registerColor, contrastBorder, transparent, foreground } from '../../color-registry';

export const ktInputBorder = registerColor('kt.input.border', { dark: '#00000000', light: '#00000000', hc: contrastBorder }, localize('ktInputBoxBorder', 'Input box border.'));
export const ktInputDisableForeground = registerColor('kt.input.disableForeground', { dark: '#5F656B', light: '#5F656B', hc: null }, localize('ktInputDisableForeground', 'Input box disabled foreground color.'));
export const ktInputDisableBackground = registerColor('kt.input.disableBackground', { dark: '#5F656B40', light: '#5F656B40', hc: null }, localize('ktInputDisableBackground', 'Input box disabled background color.'));
