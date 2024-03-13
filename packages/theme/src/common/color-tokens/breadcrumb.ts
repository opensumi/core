import { localize } from '@opensumi/ide-core-common';

import { darken, lighten, registerColor, transparent } from '../utils';

import { foreground } from './base';
import { editorBackground, editorWidgetBackground } from './editor';

/**
 * Breadcrumb colors
 */
export const breadcrumbsForeground = registerColor(
  'breadcrumb.foreground',
  {
    light: transparent(foreground, 0.8),
    dark: transparent(foreground, 0.8),
    hcDark: transparent(foreground, 0.8),
    hcLight: transparent(foreground, 0.8),
  },
  localize('breadcrumbsFocusForeground', 'Color of focused breadcrumb items.'),
);
export const breadcrumbsBackground = registerColor(
  'breadcrumb.background',
  {
    light: editorBackground,
    dark: editorBackground,
    hcDark: editorBackground,
    hcLight: editorBackground,
  },
  localize('breadcrumbsBackground', 'Background color of breadcrumb items.'),
);
export const breadcrumbsFocusForeground = registerColor(
  'breadcrumb.focusForeground',
  {
    light: darken(foreground, 0.2),
    dark: lighten(foreground, 0.1),
    hcDark: lighten(foreground, 0.1),
    hcLight: lighten(foreground, 0.1),
  },
  localize('breadcrumbsFocusForeground', 'Color of focused breadcrumb items.'),
);
export const breadcrumbsActiveSelectionForeground = registerColor(
  'breadcrumb.activeSelectionForeground',
  {
    light: darken(foreground, 0.2),
    dark: lighten(foreground, 0.1),
    hcDark: lighten(foreground, 0.1),
    hcLight: lighten(foreground, 0.1),
  },
  localize('breadcrumbsSelectedForegound', 'Color of selected breadcrumb items.'),
);
export const breadcrumbsPickerBackground = registerColor(
  'breadcrumbPicker.background',
  {
    light: editorWidgetBackground,
    dark: editorWidgetBackground,
    hcDark: editorWidgetBackground,
    hcLight: editorWidgetBackground,
  },
  localize('breadcrumbsSelectedBackground', 'Background color of breadcrumb item picker.'),
);
