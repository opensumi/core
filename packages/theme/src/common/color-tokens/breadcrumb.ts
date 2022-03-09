import { localize } from '@opensumi/ide-core-common';

import { registerColor, transparent, lighten, darken } from '../color-registry';

import { foreground } from './base';
import { editorBackground, editorWidgetBackground } from './editor';

/**
 * Breadcrumb colors
 */
export const breadcrumbsForeground = registerColor(
  'breadcrumb.foreground',
  { light: transparent(foreground, 0.8), dark: transparent(foreground, 0.8), hc: transparent(foreground, 0.8) },
  localize('breadcrumbsFocusForeground', 'Color of focused breadcrumb items.'),
);
export const breadcrumbsBackground = registerColor(
  'breadcrumb.background',
  { light: editorBackground, dark: editorBackground, hc: editorBackground },
  localize('breadcrumbsBackground', 'Background color of breadcrumb items.'),
);
export const breadcrumbsFocusForeground = registerColor(
  'breadcrumb.focusForeground',
  { light: darken(foreground, 0.2), dark: lighten(foreground, 0.1), hc: lighten(foreground, 0.1) },
  localize('breadcrumbsFocusForeground', 'Color of focused breadcrumb items.'),
);
export const breadcrumbsActiveSelectionForeground = registerColor(
  'breadcrumb.activeSelectionForeground',
  { light: darken(foreground, 0.2), dark: lighten(foreground, 0.1), hc: lighten(foreground, 0.1) },
  localize('breadcrumbsSelectedForegound', 'Color of selected breadcrumb items.'),
);
export const breadcrumbsPickerBackground = registerColor(
  'breadcrumbPicker.background',
  { light: editorWidgetBackground, dark: editorWidgetBackground, hc: editorWidgetBackground },
  localize('breadcrumbsSelectedBackground', 'Background color of breadcrumb item picker.'),
);
