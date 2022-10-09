import { localize } from '@opensumi/ide-core-common';

import { RGBA, Color } from '../../color';
import { registerColor, darken, lighten } from '../../utils';
import { foreground } from '../base';
import {
  buttonBackground,
  buttonForeground,
  buttonHoverBackground,
  buttonSecondaryBackground,
  buttonSecondaryHoverBackground,
  buttonSecondaryForeground,
  buttonBorder,
} from '../button';

/* disable button */
export const ktButtonDisableForeground = registerColor(
  'kt.button.disableForeground',
  { dark: '#5F656B', light: '#5F656B', hcDark: null, hcLight: null },
  localize('buttonDisableForeground', 'Button Disable Foreground color'),
);
export const ktButtonDisableBackground = registerColor(
  'kt.button.disableBackground',
  {
    dark: new Color(new RGBA(95, 101, 107, 0.25)),
    light: new Color(new RGBA(95, 101, 107, 0.25)),
    hcDark: null,
    hcLight: null,
  },
  localize('buttonDisableBackground', 'Button Disable Background color'),
);
export const ktButtonDisableBorder = registerColor(
  'kt.button.disableBorder',
  {
    dark: new Color(new RGBA(95, 101, 107, 0.5)),
    light: new Color(new RGBA(95, 101, 107, 0.5)),
    hcDark: null,
    hcLight: null,
  },
  localize('buttonDisableBorder', 'Button Disable Border color.'),
);

/* primary button */
export const ktPrimaryButtonForeground = registerColor(
  'kt.primaryButton.foreground',
  { dark: buttonForeground, light: buttonForeground, hcDark: buttonForeground, hcLight: buttonForeground },
  localize('primaryButtonForground', 'Primary Button Forground color.'),
);
export const ktPrimaryButtonBackground = registerColor(
  'kt.primaryButton.background',
  { dark: buttonBackground, light: buttonBackground, hcDark: buttonBackground, hcLight: buttonBackground },
  localize('primaryButtonBackground', 'Primary Button Background color.'),
);
export const ktPrimaryButtonHoverBackground = registerColor(
  'kt.primaryButton.hoverBackground',
  {
    dark: buttonHoverBackground,
    light: buttonHoverBackground,
    hcDark: buttonHoverBackground,
    hcLight: buttonHoverBackground,
  },
  localize('primaryButtonHoverBackground', 'Primary Button Hover Background color'),
);
export const ktPrimaryButtonClickBackground = registerColor(
  'kt.primaryButton.clickBackground',
  {
    dark: buttonHoverBackground,
    light: buttonHoverBackground,
    hcDark: buttonHoverBackground,
    hcLight: buttonHoverBackground,
  },
  localize('primaryButtonClickBackground', 'Primary Button Click Background color'),
);

/* primary ghost button */
export const ktPrimaryGhostButtonForeground = registerColor(
  'kt.primaryGhostButton.foreground',
  { dark: buttonForeground, light: buttonForeground, hcDark: buttonForeground, hcLight: buttonForeground },
  localize('ktPrimaryGhostButtonForeground', 'Primary Ghost Button Foreground color.'),
);
export const ktPrimaryGhostButtonBackground = registerColor(
  'kt.primaryGhostButton.background',
  { dark: null, light: null, hcDark: null, hcLight: null },
  localize('ktPrimaryGhostButtonBackground', 'Primary Ghost Button Background color.'),
);
export const ktPrimaryGhostButtonBorder = registerColor(
  'kt.primaryGhostButton.border',
  { dark: buttonBorder, light: buttonBorder, hcDark: buttonBorder, hcLight: buttonBorder },
  localize('ktPrimaryGhostButtonBorder', 'Primary Ghost Button Border color.'),
);
export const ktPrimaryGhostButtonClickForeground = registerColor(
  'kt.primaryGhostButton.clickForeground',
  {
    dark: lighten(ktPrimaryGhostButtonForeground, 0.2),
    light: darken(ktPrimaryGhostButtonForeground, 0.2),
    hcDark: ktPrimaryGhostButtonForeground,
    hcLight: ktPrimaryGhostButtonForeground,
  },
  localize('ktPrimaryGhostButtonClickForeground', 'Primary Ghost Button Click Foreground color.'),
);
export const ktPrimaryGhostButtonClickBorder = registerColor(
  'kt.primaryGhostButton.clickBorder',
  {
    dark: lighten(ktPrimaryGhostButtonBorder, 0.2),
    light: darken(ktPrimaryGhostButtonBorder, 0.2),
    hcDark: ktPrimaryGhostButtonBorder,
    hcLight: ktPrimaryGhostButtonBorder,
  },
  localize('ktPrimaryGhostButtonClickBorder', 'Primary Ghost Button Click Border color.'),
);

/* secondary button */
export const ktSecondaryButtonForeground = registerColor(
  'kt.secondaryButton.foreground',
  {
    dark: buttonSecondaryForeground,
    light: buttonSecondaryForeground,
    hcDark: buttonSecondaryForeground,
    hcLight: buttonSecondaryForeground,
  },
  localize('ktSecondaryButtonForeground', 'Secondary Button Foreground color.'),
);
export const ktSecondaryButtonBackground = registerColor(
  'kt.secondaryButton.background',
  {
    dark: buttonSecondaryBackground,
    light: buttonSecondaryBackground,
    hcDark: buttonSecondaryBackground,
    hcLight: buttonSecondaryBackground,
  },
  localize('ktSecondaryButtonBackground', 'Secondary Button Background color.'),
);
export const ktSecondaryButtonBorder = registerColor(
  'kt.secondaryButton.border',
  { dark: buttonBorder, light: buttonBorder, hcDark: buttonBorder, hcLight: buttonBorder },
  localize('ktSecondaryButtonForeground', 'Secondary Button Foreground color.'),
);
export const ktSecondaryButtonHoverBackground = registerColor(
  'kt.secondaryButton.hoverBackground',
  {
    dark: buttonSecondaryHoverBackground,
    light: buttonSecondaryHoverBackground,
    hcDark: buttonSecondaryHoverBackground,
    hcLight: buttonSecondaryHoverBackground,
  },
  localize('ktSecondaryButtonHoverBackground', 'Secondary Button Hover Background color'),
);
export const ktSecondaryButtonHoverForeground = registerColor(
  'kt.secondaryButton.hoverForeground',
  { dark: buttonSecondaryForeground, light: buttonSecondaryForeground, hcDark: null, hcLight: null },
  localize('ktSecondaryButtonHoverForeground', 'Secondary Button Hover Foreground color'),
);
export const ktSecondaryButtonHoverBorder = registerColor(
  'kt.secondaryButton.hoverBorder',
  { dark: buttonBorder, light: buttonBorder, hcDark: buttonBorder, hcLight: buttonBorder },
  localize('ktSecondaryButtonHoverBorder', 'Secondary Button Hover Border color'),
);
export const ktSecondaryButtonClickForeground = registerColor(
  'kt.secondaryButton.clickForeground',
  {
    dark: ktSecondaryButtonHoverForeground,
    light: ktSecondaryButtonHoverForeground,
    hcDark: ktSecondaryButtonHoverForeground,
    hcLight: ktSecondaryButtonHoverForeground,
  },
  localize('ktSecondaryButtonClickForeground', 'Secondary Button Click Foreground color'),
);
export const ktSecondaryButtonClickBackground = registerColor(
  'kt.secondaryButton.clickBackground',
  {
    dark: buttonSecondaryHoverBackground,
    light: buttonSecondaryHoverBackground,
    hcDark: buttonSecondaryHoverBackground,
    hcLight: buttonSecondaryHoverBackground,
  },
  localize('ktSecondaryButtonClickBackground', 'Secondary Button Click Background color'),
);
export const ktSecondaryButtonClickBorder = registerColor(
  'kt.secondaryButton.clickBorder',
  {
    dark: ktSecondaryButtonHoverBorder,
    light: ktSecondaryButtonHoverBorder,
    hcDark: ktSecondaryButtonHoverBorder,
    hcLight: ktSecondaryButtonHoverBorder,
  },
  localize('ktSecondaryButtonClickBorder', 'Secondary Button Click Border color'),
);

/* secondary ghost button */
export const ktWhiteGhostButtonForeground = registerColor(
  'kt.whiteGhostButton.foreground',
  { dark: '#FFFFFF', light: foreground, hcDark: null, hcLight: null },
  localize('ktWhiteGhostButtonForeground', 'White Ghost Button Foreground color.'),
);
export const ktWhiteGhostButtonBackground = registerColor(
  'kt.whiteGhostButton.background',
  { dark: null, light: null, hcDark: null, hcLight: null },
  localize('ktWhiteGhostButtonBackground', 'White Ghost Button Background color.'),
);
export const ktWhiteGhostButtonBorder = registerColor(
  'kt.whiteGhostButton.border',
  { dark: '#FFFFFF', light: foreground, hcDark: null, hcLight: null },
  localize('ktWhiteGhostButtonBorder', 'White Ghost Button Border color.'),
);
export const ktWhiteGhostButtonClickForeground = registerColor(
  'kt.whiteGhostButton.clickForeground',
  { dark: '#FFFFFFA6', light: '#FFFFFFA6', hcDark: null, hcLight: null },
  localize('ktWhiteGhostButtonClickForeground', 'White Ghost Button Click Foreground color.'),
);
export const ktWhiteGhostButtonClickBorder = registerColor(
  'kt.whiteGhostButton.clickBorder',
  { dark: '#FFFFFFA6', light: '#FFFFFFA6', hcDark: null, hcLight: null },
  localize('ktWhiteGhostButtonClickBorder', 'White Ghost Button Click Border color.'),
);
export const ktWhiteGhostButtonDisableForeground = registerColor(
  'kt.whiteGhostButton.disableForeground',
  { dark: '#FFFFFF40', light: '#FFFFFF40', hcDark: null, hcLight: null },
  localize('ktWhiteGhostButtonDisableForeground', 'White Ghost Button Disable Foreground color.'),
);

/* link button */
export const ktLinkButtonForeground = registerColor(
  'kt.linkButton.foreground',
  { dark: '#3895EB', light: '#3895EB', hcDark: null, hcLight: null },
  localize('ktLinkButtonForeground', 'Link Button Foreground color.'),
);
export const ktLinkButtonHoverForeground = registerColor(
  'kt.linkButton.hoverForeground',
  { dark: '#67ABEB', light: '#67ABEB', hcDark: null, hcLight: null },
  localize('ktLinkButtonHoverForeground', 'Link Button Hover Foreground color'),
);
export const ktLinkButtonClickForeground = registerColor(
  'kt.linkButton.clickForeground',
  { dark: '#167CDB', light: '#167CDB', hcDark: null, hcLight: null },
  localize('ktLinkButtonClickForeground', 'Link Button Click Foreground color'),
);
export const ktLinkButtonDisableForeground = registerColor(
  'kt.linkButton.disableForeground',
  { dark: '#5F656B', light: '#5F656B', hcDark: null, hcLight: null },
  localize('ktLinkButtonDisableForeground', 'Link Button Disable Foreground color'),
);

/* danger button */
export const ktDangerButtonForeground = registerColor(
  'kt.dangerButton.foreground',
  { dark: Color.white, light: Color.white, hcDark: Color.white, hcLight: Color.white },
  localize('ktDangerButtonForground', 'Danger Button Forground color.'),
);
export const ktDangerButtonBackground = registerColor(
  'kt.dangerButton.background',
  { dark: '#DB4345', light: '#DB4345', hcDark: null, hcLight: null },
  localize('ktDangerButtonBackground', 'Danger Button Background color.'),
);
export const ktDangerButtonHoverBackground = registerColor(
  'kt.dangerButton.hoverBackground',
  { dark: '#F37370', light: '#F37370', hcDark: null, hcLight: null },
  localize('ktDangerButtonHoverBackground', 'Danger Button Hover Background color'),
);
export const ktDangerButtonClickBackground = registerColor(
  'kt.dangerButton.clickBackground',
  { dark: '#D21F28', light: '#D21F28', hcDark: null, hcLight: null },
  localize('ktDangerButtonClickBackground', 'Danger Button Click Background color'),
);

/* danger ghost button */
export const ktDangerGhostButtonForeground = registerColor(
  'kt.dangerGhostButton.foreground',
  { dark: '#DB4345', light: '#DB4345', hcDark: null, hcLight: null },
  localize('ktDangerGhostButtonForeground', 'Danger Ghost Button Foreground color.'),
);
export const ktDangerGhostButtonBackground = registerColor(
  'kt.dangerGhostButton.background',
  { dark: null, light: null, hcDark: null, hcLight: null },
  localize('ktDangerGhostButtonBackground', 'Danger Ghost Button Background color.'),
);
export const ktDangerGhostButtonBorder = registerColor(
  'kt.dangerGhostButton.border',
  { dark: '#DB4345', light: '#DB4345', hcDark: null, hcLight: null },
  localize('ktDangerGhostButtonBorder', 'Danger Ghost Button Border color.'),
);
export const ktDangerGhostButtonHoverForeground = registerColor(
  'kt.dangerGhostButton.hoverForeground',
  { dark: '#F37370', light: '#F37370', hcDark: null, hcLight: null },
  localize('ktDangerGhostButtonHoverForeground', 'Danger Ghost Button Hover Foreground color.'),
);
export const ktDangerGhostButtonHoverBorder = registerColor(
  'kt.dangerGhostButton.hoverBorder',
  { dark: '#F37370', light: '#F37370', hcDark: null, hcLight: null },
  localize('ktDangerGhostButtonHoverBorder', 'Danger Ghost Button Hover Border color.'),
);
export const ktDangerGhostButtonClickForeground = registerColor(
  'kt.dangerGhostButton.clickForeground',
  { dark: '#D21F28', light: '#D21F28', hcDark: null, hcLight: null },
  localize('ktDangerGhostButtonClickForeground', 'Danger Ghost Button Click Foreground color.'),
);
export const ktDangerGhostButtonClickBorder = registerColor(
  'kt.dangerGhostButton.clickBorder',
  { dark: '#D21F28', light: '#D21F28', hcDark: null, hcLight: null },
  localize('ktDangerGhostButtonClickBorder', 'Danger Ghost Button Click Border color.'),
);

/* default button */
export const ktDefaultButtonForeground = registerColor(
  'kt.defaultButton.foreground',
  { dark: buttonForeground, light: buttonForeground, hcDark: buttonBackground, hcLight: buttonBackground },
  localize('ktDefaultButtonForeground', 'Default Button Foreground color.'),
);
export const ktDefaultButtonBackground = registerColor(
  'kt.defaultButton.background',
  { dark: buttonBackground, light: buttonBackground, hcDark: buttonBackground, hcLight: buttonBackground },
  localize('ktDefaultButtonBackground', 'Default Button Background color.'),
);
export const ktDefaultButtonBorder = registerColor(
  'kt.defaultButton.border',
  { dark: buttonBorder, light: buttonBorder, hcDark: buttonBorder, hcLight: buttonBorder },
  localize('ktDefaultButtonBorder', 'Default Button Border color.'),
);
export const ktDefaultButtonHoverBackground = registerColor(
  'kt.defaultButton.hoverBackground',
  {
    dark: buttonHoverBackground,
    light: buttonHoverBackground,
    hcDark: buttonHoverBackground,
    hcLight: buttonHoverBackground,
  },
  localize('ktDefaultButtonHoverBackground', 'Default Button Hover Background color.'),
);
export const ktDefaultButtonHoverForeground = registerColor(
  'kt.defaultButton.hoverForeground',
  { dark: buttonForeground, light: buttonForeground, hcDark: buttonForeground, hcLight: buttonForeground },
  localize('ktDefaultButtonHoverForeground', 'Default Button Hover Foreground color.'),
);
export const ktDefaultButtonHoverBorder = registerColor(
  'kt.defaultButton.hoverBorder',
  {
    dark: buttonHoverBackground,
    light: buttonHoverBackground,
    hcDark: buttonHoverBackground,
    hcLight: buttonHoverBackground,
  },
  localize('ktDefaultButtonHoverBorder', 'Default Button Hover Border color.'),
);
export const ktDefaultButtonClickBackground = registerColor(
  'kt.defaultButton.clickBackground',
  {
    dark: buttonHoverBackground,
    light: buttonHoverBackground,
    hcDark: buttonHoverBackground,
    hcLight: buttonHoverBackground,
  },
  localize('ktDefaultButtonClickBackground', 'Default Button Click Background color.'),
);
export const ktDefaultButtonClickBorder = registerColor(
  'kt.defaultButton.clickBorder',
  {
    dark: buttonHoverBackground,
    light: buttonHoverBackground,
    hcDark: buttonHoverBackground,
    hcLight: buttonHoverBackground,
  },
  localize('ktDangerGhostButtonClickBorder', 'Default Button Click Border color.'),
);
