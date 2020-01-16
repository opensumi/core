import { TAB_BORDER } from '../tab';
import { registerColor } from '../../color-registry';
import { localize } from '@ali/ide-core-common';
import { foreground } from '../base';

export const ktEditorBreadcrumbBorderDown = registerColor('kt.editorBreadcrumb.borderDown', {
  dark: '#2C3033',
  light: TAB_BORDER,
  hc: TAB_BORDER,
}, localize('kt.editorBreadcrumb.borderDown', 'editor Breadcrumb\'s bottom border color.'));

export const ktDirtyDotForeground = registerColor('kt.dirtyDot.foreground', {
  dark: '#BBC0C4',
  light: foreground,
  hc: foreground,
}, localize('kt.dirtyDot.foreground', 'color for dirty mark.'));
