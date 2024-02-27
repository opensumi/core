import { localize } from '@opensumi/ide-core-common';

import { Color } from '../../common/color';
import { registerColor, transparent } from '../utils';

/**
 * Merge-conflict colors
 */

const headerTransparency = 0.5;
const currentBaseColor = Color.fromHex('#40C8AE').transparent(headerTransparency);
const incomingBaseColor = Color.fromHex('#40A6FF').transparent(headerTransparency);
const commonBaseColor = Color.fromHex('#606060').transparent(0.4);
const contentTransparency = 0.4;
const rulerTransparency = 1;

export const mergeCurrentHeaderBackground = registerColor(
  'merge.currentHeaderBackground',
  { dark: currentBaseColor, light: currentBaseColor, hcDark: null, hcLight: null },
  localize(
    'mergeCurrentHeaderBackground',
    'Current header background in inline merge-conflicts. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
export const mergeCurrentContentBackground = registerColor(
  'merge.currentContentBackground',
  {
    dark: transparent(mergeCurrentHeaderBackground, contentTransparency),
    light: transparent(mergeCurrentHeaderBackground, contentTransparency),
    hcDark: transparent(mergeCurrentHeaderBackground, contentTransparency),
    hcLight: transparent(mergeCurrentHeaderBackground, contentTransparency),
  },
  localize(
    'mergeCurrentContentBackground',
    'Current content background in inline merge-conflicts. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
export const mergeIncomingHeaderBackground = registerColor(
  'merge.incomingHeaderBackground',
  { dark: incomingBaseColor, light: incomingBaseColor, hcDark: null, hcLight: null },
  localize(
    'mergeIncomingHeaderBackground',
    'Incoming header background in inline merge-conflicts. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
export const mergeIncomingContentBackground = registerColor(
  'merge.incomingContentBackground',
  {
    dark: transparent(mergeIncomingHeaderBackground, contentTransparency),
    light: transparent(mergeIncomingHeaderBackground, contentTransparency),
    hcDark: transparent(mergeIncomingHeaderBackground, contentTransparency),
    hcLight: transparent(mergeIncomingHeaderBackground, contentTransparency),
  },
  localize(
    'mergeIncomingContentBackground',
    'Incoming content background in inline merge-conflicts. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
export const mergeCommonHeaderBackground = registerColor(
  'merge.commonHeaderBackground',
  { dark: commonBaseColor, light: commonBaseColor, hcDark: null, hcLight: null },
  localize(
    'mergeCommonHeaderBackground',
    'Common ancestor header background in inline merge-conflicts. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
export const mergeCommonContentBackground = registerColor(
  'merge.commonContentBackground',
  {
    dark: transparent(mergeCommonHeaderBackground, contentTransparency),
    light: transparent(mergeCommonHeaderBackground, contentTransparency),
    hcDark: transparent(mergeCommonHeaderBackground, contentTransparency),
    hcLight: transparent(mergeCommonHeaderBackground, contentTransparency),
  },
  localize(
    'mergeCommonContentBackground',
    'Common ancestor content background in inline merge-conflicts. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);

export const mergeBorder = registerColor(
  'merge.border',
  { dark: null, light: null, hcDark: '#C3DF6F', hcLight: '#007ACC' },
  localize('mergeBorder', 'Border color on headers and the splitter in inline merge-conflicts.'),
);

export const overviewRulerCurrentContentForeground = registerColor(
  'editorOverviewRuler.currentContentForeground',
  {
    dark: transparent(mergeCurrentHeaderBackground, rulerTransparency),
    light: transparent(mergeCurrentHeaderBackground, rulerTransparency),
    hcDark: mergeBorder,
    hcLight: mergeBorder,
  },
  localize('overviewRulerCurrentContentForeground', 'Current overview ruler foreground for inline merge-conflicts.'),
);
export const overviewRulerIncomingContentForeground = registerColor(
  'editorOverviewRuler.incomingContentForeground',
  {
    dark: transparent(mergeIncomingHeaderBackground, rulerTransparency),
    light: transparent(mergeIncomingHeaderBackground, rulerTransparency),
    hcDark: mergeBorder,
    hcLight: mergeBorder,
  },
  localize('overviewRulerIncomingContentForeground', 'Incoming overview ruler foreground for inline merge-conflicts.'),
);
export const overviewRulerCommonContentForeground = registerColor(
  'editorOverviewRuler.commonContentForeground',
  {
    dark: transparent(mergeCommonHeaderBackground, rulerTransparency),
    light: transparent(mergeCommonHeaderBackground, rulerTransparency),
    hcDark: mergeBorder,
    hcLight: mergeBorder,
  },
  localize(
    'overviewRulerCommonContentForeground',
    'Common ancestor overview ruler foreground for inline merge-conflicts.',
  ),
);

export const overviewRulerFindMatchForeground = registerColor(
  'editorOverviewRuler.findMatchForeground',
  { dark: '#d186167e', light: '#d186167e', hcDark: '#AB5A00', hcLight: null },
  localize(
    'overviewRulerFindMatchForeground',
    'Overview ruler marker color for find matches. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);

export const overviewRulerSelectionHighlightForeground = registerColor(
  'editorOverviewRuler.selectionHighlightForeground',
  { dark: '#A0A0A0CC', light: '#A0A0A0CC', hcDark: '#A0A0A0CC', hcLight: '#A0A0A0CC' },
  localize(
    'overviewRulerSelectionHighlightForeground',
    'Overview ruler marker color for selection highlights. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
