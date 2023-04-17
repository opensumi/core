/**
 * monaco 编辑器内使用了 --vscode 前缀的 CSS Token，这里对其进行定义
 */
import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../../utils';

export const editorSuggesFocusHighlightForeground = registerColor(
  'vscode.editorSuggestWidget.focusHighlightForeground',
  { light: '#1a85ff', dark: '#58a6ff', hcDark: null, hcLight: null },
  localize(
    'editorSuggesFocusHighlightForeground',
    'List/Tree foreground color of the match highlights on actively focused items when searching inside the list/tree.',
  ),
);
