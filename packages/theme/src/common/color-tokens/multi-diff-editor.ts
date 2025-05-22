import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../utils';

import { editorBackground } from './editor';

export const multiDiffEditorHeaderBackground = registerColor(
  'multiDiffEditor.headerBackground',
  {
    dark: '#262626',
    light: 'tab.inactiveBackground',
    hcDark: 'tab.inactiveBackground',
    hcLight: 'tab.inactiveBackground',
  },
  "The background color of the diff editor's header",
);

export const multiDiffEditorBackground = registerColor(
  'multiDiffEditor.background',
  { dark: editorBackground, light: editorBackground, hcDark: editorBackground, hcLight: editorBackground },
  localize('multiDiffEditor.background', 'The background color of the multi file diff editor'),
);

export const multiDiffEditorBorder = registerColor(
  'multiDiffEditor.border',
  { dark: 'sideBarSectionHeader.border', light: '#cccccc', hcDark: 'sideBarSectionHeader.border', hcLight: '#cccccc' },
  localize('multiDiffEditor.border', 'The border color of the multi file diff editor'),
);
