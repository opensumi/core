import { localize } from '@opensumi/ide-core-common';

import { RGBA, Color } from '../color';
import { registerColor, transparent } from '../utils';

import { editorWarningForeground, editorWarningBorder } from './editor';
import {
  scrollbarSliderActiveBackground,
  scrollbarSliderBackground,
  scrollbarSliderHoverBackground,
} from './scrollbar';

export const minimapFindMatch = registerColor(
  'minimap.findMatchHighlight',
  { light: '#d18616', dark: '#d18616', hcDark: '#AB5A00', hcLight: '#0F4A85' },
  localize('minimapFindMatchHighlight', 'Minimap marker color for find matches.'),
  true,
);
export const minimapSelectionOccurrenceHighlight = registerColor(
  'minimap.selectionOccurrenceHighlight',
  { light: '#c9c9c9', dark: '#676767', hcDark: '#ffffff', hcLight: '#0F4A85' },
  localize('minimapSelectionOccurrenceHighlight', 'Minimap marker color for repeating editor selections.'),
  true,
);
export const minimapSelection = registerColor(
  'minimap.selectionHighlight',
  { light: '#ADD6FF', dark: '#264F78', hcDark: '#ffffff', hcLight: '#0F4A85' },
  localize('minimapSelectionHighlight', 'Minimap marker color for the editor selection.'),
  true,
);
export const minimapError = registerColor(
  'minimap.errorHighlight',
  {
    dark: new Color(new RGBA(255, 18, 18, 0.7)),
    light: new Color(new RGBA(255, 18, 18, 0.7)),
    hcDark: new Color(new RGBA(255, 50, 50, 1)),
    hcLight: '#B5200D',
  },
  localize('minimapError', 'Minimap marker color for errors.'),
);
export const minimapWarning = registerColor(
  'minimap.warningHighlight',
  {
    dark: editorWarningForeground,
    light: editorWarningForeground,
    hcDark: editorWarningBorder,
    hcLight: editorWarningBorder,
  },
  localize('overviewRuleWarning', 'Minimap marker color for warnings.'),
);
export const minimapBackground = registerColor(
  'minimap.background',
  { dark: null, light: null, hcDark: null, hcLight: null },
  localize('minimapBackground', 'Minimap background color.'),
);
export const minimapForegroundOpacity = registerColor(
  'minimap.foregroundOpacity',
  {
    dark: Color.fromHex('#000f'),
    light: Color.fromHex('#000f'),
    hcDark: Color.fromHex('#000f'),
    hcLight: Color.fromHex('#000f'),
  },
  localize(
    'minimapForegroundOpacity',
    'Opacity of foreground elements rendered in the minimap. For example, "#000000c0" will render the elements with 75% opacity.',
  ),
);

export const minimapSliderBackground = registerColor(
  'minimapSlider.background',
  {
    light: transparent(scrollbarSliderBackground, 0.5),
    dark: transparent(scrollbarSliderBackground, 0.5),
    hcDark: transparent(scrollbarSliderBackground, 0.5),
    hcLight: transparent(scrollbarSliderBackground, 0.5),
  },
  localize('minimapSliderBackground', 'Minimap slider background color.'),
);
export const minimapSliderHoverBackground = registerColor(
  'minimapSlider.hoverBackground',
  {
    light: transparent(scrollbarSliderHoverBackground, 0.5),
    dark: transparent(scrollbarSliderHoverBackground, 0.5),
    hcDark: transparent(scrollbarSliderHoverBackground, 0.5),
    hcLight: transparent(scrollbarSliderHoverBackground, 0.5),
  },
  localize('minimapSliderHoverBackground', 'Minimap slider background color when hovering.'),
);
export const minimapSliderActiveBackground = registerColor(
  'minimapSlider.activeBackground',
  {
    light: transparent(scrollbarSliderActiveBackground, 0.5),
    dark: transparent(scrollbarSliderActiveBackground, 0.5),
    hcDark: transparent(scrollbarSliderActiveBackground, 0.5),
    hcLight: transparent(scrollbarSliderActiveBackground, 0.5),
  },
  localize('minimapSliderActiveBackground', 'Minimap slider background color when clicked on.'),
);
