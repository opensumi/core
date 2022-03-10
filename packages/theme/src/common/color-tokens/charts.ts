import { localize } from '@opensumi/ide-core-common';

import { registerColor, transparent } from '../color-registry';

import { foreground } from './base';
import { editorErrorForeground, editorInfoForeground, editorWarningForeground } from './editor';
import { minimapFindMatch } from './minimap';

export const chartsForeground = registerColor(
  'charts.foreground',
  { dark: foreground, light: foreground, hc: foreground },
  localize('chartsForeground', 'The foreground color used in charts.'),
);
export const chartsLines = registerColor(
  'charts.lines',
  { dark: transparent(foreground, 0.5), light: transparent(foreground, 0.5), hc: transparent(foreground, 0.5) },
  localize('chartsLines', 'The color used for horizontal lines in charts.'),
);
export const chartsRed = registerColor(
  'charts.red',
  { dark: editorErrorForeground, light: editorErrorForeground, hc: editorErrorForeground },
  localize('chartsRed', 'The red color used in chart visualizations.'),
);
export const chartsBlue = registerColor(
  'charts.blue',
  { dark: editorInfoForeground, light: editorInfoForeground, hc: editorInfoForeground },
  localize('chartsBlue', 'The blue color used in chart visualizations.'),
);
export const chartsYellow = registerColor(
  'charts.yellow',
  { dark: editorWarningForeground, light: editorWarningForeground, hc: editorWarningForeground },
  localize('chartsYellow', 'The yellow color used in chart visualizations.'),
);
export const chartsOrange = registerColor(
  'charts.orange',
  { dark: minimapFindMatch, light: minimapFindMatch, hc: minimapFindMatch },
  localize('chartsOrange', 'The orange color used in chart visualizations.'),
);
export const chartsGreen = registerColor(
  'charts.green',
  { dark: '#89D185', light: '#388A34', hc: '#89D185' },
  localize('chartsGreen', 'The green color used in chart visualizations.'),
);
export const chartsPurple = registerColor(
  'charts.purple',
  { dark: '#B180D7', light: '#652D90', hc: '#B180D7' },
  localize('chartsPurple', 'The purple color used in chart visualizations.'),
);
