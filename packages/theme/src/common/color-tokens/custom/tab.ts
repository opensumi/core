import { localize } from '@ali/ide-core-common';
import { registerColor } from '../../color-registry';

export const ktTabBarBorderDown = registerColor('kt.tab.borderDown', { dark: '#5F656B40', light: '#5F656B40', hc: null }, localize('Activity Bar Border bottom color.'));
export const ktTabActiveForeground = registerColor('kt.tab.activeForeground', { dark: '#FFFFFF', light: '$00000040', hc: null }, localize('Tab Active foreground color.'));
export const ktTabInactiveForeground = registerColor('kt.tab.inactiveForeground', { dark: '#D7DBDE', light: '#0000060', hc: null }, localize('Tab inactive foreground color.'));
export const ktTabActiveBorder = registerColor('kt.tab.activeBorder', { dark: '#167cDB', light: '#167cDB', hc: null }, localize('Tab Active border color.'));
