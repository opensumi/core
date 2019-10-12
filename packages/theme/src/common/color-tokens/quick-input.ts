import { localize } from '@ali/ide-core-common';
import { registerColor } from '../color-registry';
import { SIDE_BAR_BACKGROUND, SIDE_BAR_FOREGROUND } from './sidebar';

// < --- Quick Input -- >

export const QUICK_INPUT_BACKGROUND = registerColor('quickInput.background', {
  dark: SIDE_BAR_BACKGROUND,
  light: SIDE_BAR_BACKGROUND,
  hc: SIDE_BAR_BACKGROUND,
}, localize('quickInputBackground', 'Quick Input background color. The Quick Input widget is the container for views like the color theme picker'));

export const QUICK_INPUT_FOREGROUND = registerColor('quickInput.foreground', {
  dark: SIDE_BAR_FOREGROUND,
  light: SIDE_BAR_FOREGROUND,
  hc: SIDE_BAR_FOREGROUND,
}, localize('quickInputForeground', 'Quick Input foreground color. The Quick Input widget is the container for views like the color theme picker'));
