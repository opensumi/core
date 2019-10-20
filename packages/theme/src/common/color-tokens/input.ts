import { localize } from '@ali/ide-core-common';
import { registerColor, transparent } from '../color-registry';
import { Color } from '../../common/color';
import { contrastBorder, foreground, focusBorder } from './base';

export const inputBackground = registerColor('input.background', { dark: '#3C3C3C', light: Color.white, hc: Color.black }, localize('inputBoxBackground', 'Input box background.'));
export const inputForeground = registerColor('input.foreground', { dark: foreground, light: foreground, hc: foreground }, localize('inputBoxForeground', 'Input box foreground.'));
export const inputBorder = registerColor('input.border', { dark: null, light: null, hc: contrastBorder }, localize('inputBoxBorder', 'Input box border.'));
export const inputOptionActiveBorder = registerColor('inputOption.activeBorder', { dark: '#007ACC', light: '#007ACC', hc: contrastBorder }, localize('inputBoxActiveOptionBorder', 'Border color of activated options in input fields.'));
export const inputOptionActiveBackground = registerColor('inputOption.activeBackground', { dark: transparent(focusBorder, 0.5), light: transparent(focusBorder, 0.3), hc: null }, localize('inputOption.activeBackground', 'Background color of activated options in input fields.'));
export const inputPlaceholderForeground = registerColor('input.placeholderForeground', { light: transparent(foreground, 0.5), dark: transparent(foreground, 0.5), hc: transparent(foreground, 0.7) }, localize('inputPlaceholderForeground', 'Input box foreground color for placeholder text.'));

export const inputValidationInfoBackground = registerColor('inputValidation.infoBackground', { dark: '#063B49', light: '#D6ECF2', hc: Color.black }, localize('inputValidationInfoBackground', 'Input validation background color for information severity.'));
export const inputValidationInfoForeground = registerColor('inputValidation.infoForeground', { dark: null, light: null, hc: null }, localize('inputValidationInfoForeground', 'Input validation foreground color for information severity.'));
export const inputValidationInfoBorder = registerColor('inputValidation.infoBorder', { dark: '#007acc', light: '#007acc', hc: contrastBorder }, localize('inputValidationInfoBorder', 'Input validation border color for information severity.'));
export const inputValidationWarningBackground = registerColor('inputValidation.warningBackground', { dark: '#352A05', light: '#F6F5D2', hc: Color.black }, localize('inputValidationWarningBackground', 'Input validation background color for warning severity.'));
export const inputValidationWarningForeground = registerColor('inputValidation.warningForeground', { dark: null, light: null, hc: null }, localize('inputValidationWarningForeground', 'Input validation foreground color for warning severity.'));
export const inputValidationWarningBorder = registerColor('inputValidation.warningBorder', { dark: '#B89500', light: '#B89500', hc: contrastBorder }, localize('inputValidationWarningBorder', 'Input validation border color for warning severity.'));
export const inputValidationErrorBackground = registerColor('inputValidation.errorBackground', { dark: '#5A1D1D', light: '#F2DEDE', hc: Color.black }, localize('inputValidationErrorBackground', 'Input validation background color for error severity.'));
export const inputValidationErrorForeground = registerColor('inputValidation.errorForeground', { dark: null, light: null, hc: null }, localize('inputValidationErrorForeground', 'Input validation foreground color for error severity.'));
export const inputValidationErrorBorder = registerColor('inputValidation.errorBorder', { dark: '#BE1100', light: '#BE1100', hc: contrastBorder }, localize('inputValidationErrorBorder', 'Input validation border color for error severity.'));
