import { localize } from '@opensumi/ide-core-common';

import { Color } from '../color';
import { registerColor, darken, lighten } from '../utils';

import { contrastBorder, foreground } from './base';

/** default button */
export const buttonForeground = registerColor(
  'button.foreground',
  {
    dark: Color.white,
    light: Color.white,
    hcDark: Color.white,
    hcLight: Color.white,
  },
  localize('buttonForeground', 'Button foreground color.'),
);
export const buttonBackground = registerColor(
  'button.background',
  { dark: '#0E639C', light: '#007ACC', hcDark: null, hcLight: '#0F4A85' },
  localize('buttonBackground', 'Button background color.'),
);
export const buttonHoverBackground = registerColor(
  'button.hoverBackground',
  {
    dark: lighten(buttonBackground, 0.2),
    light: darken(buttonBackground, 0.2),
    hcDark: null,
    hcLight: null,
  },
  localize('buttonHoverBackground', 'Button background color when hovering.'),
);
export const buttonBorder = registerColor(
  'button.border',
  {
    dark: contrastBorder,
    light: contrastBorder,
    hcDark: contrastBorder,
    hcLight: contrastBorder,
  },
  localize('buttonBorderBackground', 'Button border color'),
);
/** secondary button */
export const buttonSecondaryForeground = registerColor(
  'button.foreground',
  {
    dark: Color.white,
    light: Color.white,
    hcDark: Color.white,
    hcLight: foreground,
  },
  localize('buttonSecondaryForeground', 'Button Secondary foreground color.'),
);
export const buttonSecondaryBackground = registerColor(
  'button.background',
  { dark: '#3A3D41', light: '#5F6A79', hcDark: null, hcLight: null },
  localize('buttonSecondaryForeground', 'Button Secondary background color.'),
);
export const buttonSecondaryHoverBackground = registerColor(
  'button.hoverBackground',
  {
    dark: lighten(buttonSecondaryBackground, 0.2),
    light: darken(buttonSecondaryBackground, 0.2),
    hcDark: null,
    hcLight: null,
  },
  localize('buttonSecondaryForeground', 'Button Secondary background color when hovering.'),
);
