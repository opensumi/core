import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../../color-registry';
import { foreground } from '../base';
import { TAB_BORDER } from '../tab';

export const ktEditorBreadcrumbBorderDown = registerColor(
  'kt.editorBreadcrumb.borderDown',
  {
    dark: '#2C3033',
    light: '#F2F2F2',
    hc: TAB_BORDER,
  },
  localize('kt.editorBreadcrumb.borderDown', "editor Breadcrumb's bottom border color."),
);

export const ktDirtyDotForeground = registerColor(
  'kt.dirtyDot.foreground',
  {
    dark: '#868C91',
    light: '#999999',
    hc: foreground,
  },
  localize('kt.dirtyDot.foreground', 'color for dirty mark.'),
);
