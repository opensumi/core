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
  { dark: '#5F656B', light: '#5F656B', hc: null },
  localize('buttonDisableForeground', 'Button Disable Foreground color'),
);
export const ktButtonDisableBackground = registerColor(
  'kt.button.disableBackground',
  {
    dark: new Color(new RGBA(95, 101, 107, 0.25)),
    light: new Color(new RGBA(95, 101, 107, 0.25)),
    hc: null,
  },
  localize('buttonDisableBackground', 'Button Disable Background color'),
);
export const ktButtonDisableBorder = registerColor(
  'kt.button.disableBorder',
  {
    dark: new Color(new RGBA(95, 101, 107, 0.5)),
    light: new Color(new RGBA(95, 101, 107, 0.5)),
    hc: null,
  },
  localize('buttonDisableBorder', 'Button Disable Border color.'),
);

/* primary button */
export const ktPrimaryButtonForeground = registerColor(
  'kt.primaryButton.foreground',
  { dark: buttonForeground, light: buttonForeground, hc: Color.white },
  localize('primaryButtonForground', 'Primary Button Forground color.'),
);
export const ktPrimaryButtonBackground = registerColor(
  'kt.primaryButton.background',
  { dark: buttonBackground, light: buttonBackground, hc: null },
  localize('primaryButtonBackground', 'Primary Button Background color.'),
);
export const ktPrimaryButtonBorder = registerColor(
  'kt.primaryButton.border',
  { dark: buttonBorder, light: buttonBorder, hc: buttonBorder },
  localize('primaryButtonBorder', 'Primary Button Border color.'),
);
export const ktPrimaryButtonHoverBackground = registerColor(
  'kt.primaryButton.hoverBackground',
  { dark: buttonHoverBackground, light: buttonHoverBackground, hc: null },
  localize('primaryButtonHoverBackground', 'Primary Button Hover Background color'),
);
export const ktPrimaryButtonClickBackground = registerColor(
  'kt.primaryButton.clickBackground',
  { dark: buttonHoverBackground, light: buttonHoverBackground, hc: null },
  localize('primaryButtonClickBackground', 'Primary Button Click Background color'),
);

/* primary ghost button */
export const ktPrimaryGhostButtonForeground = registerColor(
  'kt.primaryGhostButton.foreground',
  // Light 模式下使用 `ktPrimaryButtonBackground` 能兼容更多主题下展示效果
  // 已达到 https://github.com/opensumi/core/wiki/Button-%E6%8C%89%E9%92%AE#%E5%9B%BE%E4%BE%8B 规范
  { dark: ktPrimaryButtonForeground, light: ktPrimaryButtonBackground, hc: Color.white },
  localize('ktPrimaryGhostButtonForeground', 'Primary Ghost Button Foreground color.'),
);
export const ktPrimaryGhostButtonBackground = registerColor(
  'kt.primaryGhostButton.background',
  { dark: null, light: null, hc: null },
  localize('ktPrimaryGhostButtonBackground', 'Primary Ghost Button Background color.'),
);
export const ktPrimaryGhostButtonBorder = registerColor(
  'kt.primaryGhostButton.border',
  { dark: ktPrimaryButtonForeground, light: ktPrimaryButtonBackground, hc: ktPrimaryButtonForeground },
  localize('ktPrimaryGhostButtonBorder', 'Primary Ghost Button Border color.'),
);
export const ktPrimaryGhostButtonClickForeground = registerColor(
  'kt.primaryGhostButton.clickForeground',
  {
    dark: lighten(ktPrimaryGhostButtonForeground, 0.2),
    light: darken(ktPrimaryGhostButtonForeground, 0.2),
    hc: ktPrimaryGhostButtonForeground,
  },
  localize('ktPrimaryGhostButtonClickForeground', 'Primary Ghost Button Click Foreground color.'),
);
export const ktPrimaryGhostButtonClickBorder = registerColor(
  'kt.primaryGhostButton.clickBorder',
  {
    dark: lighten(ktPrimaryGhostButtonBorder, 0.2),
    light: darken(ktPrimaryGhostButtonBorder, 0.2),
    hc: ktPrimaryGhostButtonBorder,
  },
  localize('ktPrimaryGhostButtonClickBorder', 'Primary Ghost Button Click Border color.'),
);

/* secondary button */
export const ktSecondaryButtonForeground = registerColor(
  'kt.secondaryButton.foreground',
  {
    dark: buttonSecondaryForeground,
    light: buttonSecondaryBackground,
    hc: buttonSecondaryForeground,
  },
  localize('ktSecondaryButtonForeground', 'Secondary Button Foreground color.'),
);
export const ktSecondaryButtonBackground = registerColor(
  'kt.secondaryButton.background',
  { dark: null, light: null, hc: null },
  localize('ktSecondaryButtonBackground', 'Secondary Button Background color.'),
);
export const ktSecondaryButtonBorder = registerColor(
  'kt.secondaryButton.border',
  {
    dark: buttonSecondaryForeground,
    light: buttonSecondaryBackground,
    hc: buttonSecondaryForeground,
  },
  localize('ktSecondaryButtonForeground', 'Secondary Button Foreground color.'),
);
export const ktSecondaryButtonHoverBackground = registerColor(
  'kt.secondaryButton.hoverBackground',
  { dark: null, light: null, hc: null },
  localize('ktSecondaryButtonHoverBackground', 'Secondary Button Hover Background color'),
);
export const ktSecondaryButtonHoverForeground = registerColor(
  'kt.secondaryButton.hoverForeground',
  { dark: buttonSecondaryHoverBackground, light: buttonSecondaryHoverBackground, hc: buttonSecondaryHoverBackground },
  localize('ktSecondaryButtonHoverForeground', 'Secondary Button Hover Foreground color'),
);
export const ktSecondaryButtonHoverBorder = registerColor(
  'kt.secondaryButton.hoverBorder',
  { dark: buttonSecondaryHoverBackground, light: buttonSecondaryHoverBackground, hc: buttonSecondaryHoverBackground },
  localize('ktSecondaryButtonHoverBorder', 'Secondary Button Hover Border color'),
);
export const ktSecondaryButtonClickForeground = registerColor(
  'kt.secondaryButton.clickForeground',
  {
    dark: ktSecondaryButtonHoverForeground,
    light: ktSecondaryButtonHoverForeground,
    hc: ktSecondaryButtonHoverForeground,
  },
  localize('ktSecondaryButtonClickForeground', 'Secondary Button Click Foreground color'),
);
export const ktSecondaryButtonClickBackground = registerColor(
  'kt.secondaryButton.clickBackground',
  { dark: buttonSecondaryHoverBackground, light: buttonSecondaryHoverBackground, hc: buttonSecondaryHoverBackground },
  localize('ktSecondaryButtonClickBackground', 'Secondary Button Click Background color'),
);
export const ktSecondaryButtonClickBorder = registerColor(
  'kt.secondaryButton.clickBorder',
  { dark: ktSecondaryButtonHoverBorder, light: ktSecondaryButtonHoverBorder, hc: ktSecondaryButtonHoverBorder },
  localize('ktSecondaryButtonClickBorder', 'Secondary Button Click Border color'),
);

/* secondary ghost button */
export const ktWhiteGhostButtonForeground = registerColor(
  'kt.whiteGhostButton.foreground',
  { dark: '#FFFFFF', light: foreground, hc: null },
  localize('ktWhiteGhostButtonForeground', 'White Ghost Button Foreground color.'),
);
export const ktWhiteGhostButtonBackground = registerColor(
  'kt.whiteGhostButton.background',
  { dark: null, light: null, hc: null },
  localize('ktWhiteGhostButtonBackground', 'White Ghost Button Background color.'),
);
export const ktWhiteGhostButtonBorder = registerColor(
  'kt.whiteGhostButton.border',
  { dark: '#FFFFFF', light: foreground, hc: null },
  localize('ktWhiteGhostButtonBorder', 'White Ghost Button Border color.'),
);
export const ktWhiteGhostButtonClickForeground = registerColor(
  'kt.whiteGhostButton.clickForeground',
  { dark: '#FFFFFFA6', light: '#FFFFFFA6', hc: null },
  localize('ktWhiteGhostButtonClickForeground', 'White Ghost Button Click Foreground color.'),
);
export const ktWhiteGhostButtonClickBorder = registerColor(
  'kt.whiteGhostButton.clickBorder',
  { dark: '#FFFFFFA6', light: '#FFFFFFA6', hc: null },
  localize('ktWhiteGhostButtonClickBorder', 'White Ghost Button Click Border color.'),
);
export const ktWhiteGhostButtonDisableForeground = registerColor(
  'kt.whiteGhostButton.disableForeground',
  { dark: '#FFFFFF40', light: '#FFFFFF40', hc: null },
  localize('ktWhiteGhostButtonDisableForeground', 'White Ghost Button Disable Foreground color.'),
);

/* link button */
export const ktLinkButtonForeground = registerColor(
  'kt.linkButton.foreground',
  { dark: '#3895EB', light: '#3895EB', hc: null },
  localize('ktLinkButtonForeground', 'Link Button Foreground color.'),
);
export const ktLinkButtonHoverForeground = registerColor(
  'kt.linkButton.hoverForeground',
  { dark: '#67ABEB', light: '#67ABEB', hc: null },
  localize('ktLinkButtonHoverForeground', 'Link Button Hover Foreground color'),
);
export const ktLinkButtonClickForeground = registerColor(
  'kt.linkButton.clickForeground',
  { dark: '#167CDB', light: '#167CDB', hc: null },
  localize('ktLinkButtonClickForeground', 'Link Button Click Foreground color'),
);
export const ktLinkButtonDisableForeground = registerColor(
  'kt.linkButton.disableForeground',
  { dark: '#5F656B', light: '#5F656B', hc: null },
  localize('ktLinkButtonDisableForeground', 'Link Button Disable Foreground color'),
);

/* danger button */
export const ktDangerButtonForeground = registerColor(
  'kt.dangerButton.foreground',
  { dark: Color.white, light: Color.white, hc: Color.white },
  localize('ktDangerButtonForground', 'Danger Button Forground color.'),
);
export const ktDangerButtonBackground = registerColor(
  'kt.dangerButton.background',
  { dark: '#DB4345', light: '#DB4345', hc: null },
  localize('ktDangerButtonBackground', 'Danger Button Background color.'),
);
export const ktDangerButtonHoverBackground = registerColor(
  'kt.dangerButton.hoverBackground',
  { dark: '#F37370', light: '#F37370', hc: null },
  localize('ktDangerButtonHoverBackground', 'Danger Button Hover Background color'),
);
export const ktDangerButtonClickBackground = registerColor(
  'kt.dangerButton.clickBackground',
  { dark: '#D21F28', light: '#D21F28', hc: null },
  localize('ktDangerButtonClickBackground', 'Danger Button Click Background color'),
);

/* danger ghost button */
export const ktDangerGhostButtonForeground = registerColor(
  'kt.dangerGhostButton.foreground',
  { dark: '#DB4345', light: '#DB4345', hc: null },
  localize('ktDangerGhostButtonForeground', 'Danger Ghost Button Foreground color.'),
);
export const ktDangerGhostButtonBackground = registerColor(
  'kt.dangerGhostButton.background',
  { dark: null, light: null, hc: null },
  localize('ktDangerGhostButtonBackground', 'Danger Ghost Button Background color.'),
);
export const ktDangerGhostButtonBorder = registerColor(
  'kt.dangerGhostButton.border',
  { dark: '#DB4345', light: '#DB4345', hc: null },
  localize('ktDangerGhostButtonBorder', 'Danger Ghost Button Border color.'),
);
export const ktDangerGhostButtonHoverForeground = registerColor(
  'kt.dangerGhostButton.hoverForeground',
  { dark: '#F37370', light: '#F37370', hc: null },
  localize('ktDangerGhostButtonHoverForeground', 'Danger Ghost Button Hover Foreground color.'),
);
export const ktDangerGhostButtonHoverBorder = registerColor(
  'kt.dangerGhostButton.hoverBorder',
  { dark: '#F37370', light: '#F37370', hc: null },
  localize('ktDangerGhostButtonHoverBorder', 'Danger Ghost Button Hover Border color.'),
);
export const ktDangerGhostButtonClickForeground = registerColor(
  'kt.dangerGhostButton.clickForeground',
  { dark: '#D21F28', light: '#D21F28', hc: null },
  localize('ktDangerGhostButtonClickForeground', 'Danger Ghost Button Click Foreground color.'),
);
export const ktDangerGhostButtonClickBorder = registerColor(
  'kt.dangerGhostButton.clickBorder',
  { dark: '#D21F28', light: '#D21F28', hc: null },
  localize('ktDangerGhostButtonClickBorder', 'Danger Ghost Button Click Border color.'),
);

/* default button */
export const ktDefaultButtonForeground = registerColor(
  'kt.defaultButton.foreground',
  { dark: buttonForeground, light: buttonForeground, hc: buttonBackground },
  localize('ktDefaultButtonForeground', 'Default Button Foreground color.'),
);
export const ktDefaultButtonBackground = registerColor(
  'kt.defaultButton.background',
  { dark: buttonBackground, light: buttonBackground, hc: buttonBackground },
  localize('ktDefaultButtonBackground', 'Default Button Background color.'),
);
export const ktDefaultButtonBorder = registerColor(
  'kt.defaultButton.border',
  { dark: buttonBorder, light: buttonBorder, hc: buttonBorder },
  localize('ktDefaultButtonBorder', 'Default Button Border color.'),
);
export const ktDefaultButtonHoverBackground = registerColor(
  'kt.defaultButton.hoverBackground',
  { dark: buttonHoverBackground, light: buttonHoverBackground, hc: buttonHoverBackground },
  localize('ktDefaultButtonHoverBackground', 'Default Button Hover Background color.'),
);
export const ktDefaultButtonHoverForeground = registerColor(
  'kt.defaultButton.hoverForeground',
  { dark: buttonForeground, light: buttonForeground, hc: buttonForeground },
  localize('ktDefaultButtonHoverForeground', 'Default Button Hover Foreground color.'),
);
export const ktDefaultButtonHoverBorder = registerColor(
  'kt.defaultButton.hoverBorder',
  { dark: buttonHoverBackground, light: buttonHoverBackground, hc: buttonHoverBackground },
  localize('ktDefaultButtonHoverBorder', 'Default Button Hover Border color.'),
);
export const ktDefaultButtonClickBackground = registerColor(
  'kt.defaultButton.clickBackground',
  { dark: buttonHoverBackground, light: buttonHoverBackground, hc: buttonHoverBackground },
  localize('ktDefaultButtonClickBackground', 'Default Button Click Background color.'),
);
export const ktDefaultButtonClickBorder = registerColor(
  'kt.defaultButton.clickBorder',
  { dark: buttonHoverBackground, light: buttonHoverBackground, hc: buttonHoverBackground },
  localize('ktDangerGhostButtonClickBorder', 'Default Button Click Border color.'),
);
