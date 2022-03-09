import { localize } from '@opensumi/ide-core-common';

import { Color } from '../../common/color';
import { registerColor, transparent } from '../color-registry';

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
  { dark: currentBaseColor, light: currentBaseColor, hc: null },
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
    hc: transparent(mergeCurrentHeaderBackground, contentTransparency),
  },
  localize(
    'mergeCurrentContentBackground',
    'Current content background in inline merge-conflicts. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
export const mergeIncomingHeaderBackground = registerColor(
  'merge.incomingHeaderBackground',
  { dark: incomingBaseColor, light: incomingBaseColor, hc: null },
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
    hc: transparent(mergeIncomingHeaderBackground, contentTransparency),
  },
  localize(
    'mergeIncomingContentBackground',
    'Incoming content background in inline merge-conflicts. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
export const mergeCommonHeaderBackground = registerColor(
  'merge.commonHeaderBackground',
  { dark: commonBaseColor, light: commonBaseColor, hc: null },
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
    hc: transparent(mergeCommonHeaderBackground, contentTransparency),
  },
  localize(
    'mergeCommonContentBackground',
    'Common ancestor content background in inline merge-conflicts. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);

export const mergeBorder = registerColor(
  'merge.border',
  { dark: null, light: null, hc: '#C3DF6F' },
  localize('mergeBorder', 'Border color on headers and the splitter in inline merge-conflicts.'),
);

export const overviewRulerCurrentContentForeground = registerColor(
  'editorOverviewRuler.currentContentForeground',
  {
    dark: transparent(mergeCurrentHeaderBackground, rulerTransparency),
    light: transparent(mergeCurrentHeaderBackground, rulerTransparency),
    hc: mergeBorder,
  },
  localize('overviewRulerCurrentContentForeground', 'Current overview ruler foreground for inline merge-conflicts.'),
);
export const overviewRulerIncomingContentForeground = registerColor(
  'editorOverviewRuler.incomingContentForeground',
  {
    dark: transparent(mergeIncomingHeaderBackground, rulerTransparency),
    light: transparent(mergeIncomingHeaderBackground, rulerTransparency),
    hc: mergeBorder,
  },
  localize('overviewRulerIncomingContentForeground', 'Incoming overview ruler foreground for inline merge-conflicts.'),
);
export const overviewRulerCommonContentForeground = registerColor(
  'editorOverviewRuler.commonContentForeground',
  {
    dark: transparent(mergeCommonHeaderBackground, rulerTransparency),
    light: transparent(mergeCommonHeaderBackground, rulerTransparency),
    hc: mergeBorder,
  },
  localize(
    'overviewRulerCommonContentForeground',
    'Common ancestor overview ruler foreground for inline merge-conflicts.',
  ),
);

export const overviewRulerFindMatchForeground = registerColor(
  'editorOverviewRuler.findMatchForeground',
  { dark: '#d186167e', light: '#d186167e', hc: '#AB5A00' },
  localize(
    'overviewRulerFindMatchForeground',
    'Overview ruler marker color for find matches. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);

export const overviewRulerSelectionHighlightForeground = registerColor(
  'editorOverviewRuler.selectionHighlightForeground',
  { dark: '#A0A0A0CC', light: '#A0A0A0CC', hc: '#A0A0A0CC' },
  localize(
    'overviewRulerSelectionHighlightForeground',
    'Overview ruler marker color for selection highlights. The color must not be opaque so as not to hide underlying decorations.',
  ),
  true,
);
