import { localize } from '@opensumi/ide-core-common';

import { RGBA, Color } from '../color';
import { registerColor } from '../color-registry';

import { editorWarningForeground, editorWarningBorder } from './editor';

export const minimapFindMatch = registerColor(
  'minimap.findMatchHighlight',
  { light: '#d18616', dark: '#d18616', hc: '#AB5A00' },
  localize('minimapFindMatchHighlight', 'Minimap marker color for find matches.'),
  true,
);
export const minimapSelection = registerColor(
  'minimap.selectionHighlight',
  { light: '#ADD6FF', dark: '#264F78', hc: '#ffffff' },
  localize('minimapSelectionHighlight', 'Minimap marker color for the editor selection.'),
  true,
);
export const minimapError = registerColor(
  'minimap.errorHighlight',
  {
    dark: new Color(new RGBA(255, 18, 18, 0.7)),
    light: new Color(new RGBA(255, 18, 18, 0.7)),
    hc: new Color(new RGBA(255, 50, 50, 1)),
  },
  localize('minimapError', 'Minimap marker color for errors.'),
);
export const minimapWarning = registerColor(
  'minimap.warningHighlight',
  { dark: editorWarningForeground, light: editorWarningForeground, hc: editorWarningBorder },
  localize('overviewRuleWarning', 'Minimap marker color for warnings.'),
);
export const minimapBackground = registerColor(
  'minimap.background',
  { dark: null, light: null, hc: null },
  localize('minimapBackground', 'Minimap background color.'),
);
