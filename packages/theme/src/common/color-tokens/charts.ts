import { localize } from '@opensumi/ide-core-common';

import { transparent, registerColor } from '../utils';

import { foreground } from './base';
import { editorErrorForeground, editorInfoForeground, editorWarningForeground } from './editor';
import { minimapFindMatch } from './minimap';

export const chartsForeground = registerColor(
  'charts.foreground',
  { dark: foreground, light: foreground, hcDark: foreground, hcLight: foreground },
  localize('chartsForeground', 'The foreground color used in charts.'),
);
export const chartsLines = registerColor(
  'charts.lines',
  {
    dark: transparent(foreground, 0.5),
    light: transparent(foreground, 0.5),
    hcDark: transparent(foreground, 0.5),
    hcLight: transparent(foreground, 0.5),
  },
  localize('chartsLines', 'The color used for horizontal lines in charts.'),
);
export const chartsRed = registerColor(
  'charts.red',
  {
    dark: editorErrorForeground,
    light: editorErrorForeground,
    hcDark: editorErrorForeground,
    hcLight: editorErrorForeground,
  },
  localize('chartsRed', 'The red color used in chart visualizations.'),
);
export const chartsBlue = registerColor(
  'charts.blue',
  {
    dark: editorInfoForeground,
    light: editorInfoForeground,
    hcDark: editorInfoForeground,
    hcLight: editorInfoForeground,
  },
  localize('chartsBlue', 'The blue color used in chart visualizations.'),
);
export const chartsYellow = registerColor(
  'charts.yellow',
  {
    dark: editorWarningForeground,
    light: editorWarningForeground,
    hcDark: editorWarningForeground,
    hcLight: editorWarningForeground,
  },
  localize('chartsYellow', 'The yellow color used in chart visualizations.'),
);
export const chartsOrange = registerColor(
  'charts.orange',
  { dark: minimapFindMatch, light: minimapFindMatch, hcDark: minimapFindMatch, hcLight: minimapFindMatch },
  localize('chartsOrange', 'The orange color used in chart visualizations.'),
);
export const chartsGreen = registerColor(
  'charts.green',
  { dark: '#89D185', light: '#388A34', hcDark: '#89D185', hcLight: '#374e06' },
  localize('chartsGreen', 'The green color used in chart visualizations.'),
);
export const chartsPurple = registerColor(
  'charts.purple',
  { dark: '#B180D7', light: '#652D90', hcDark: '#B180D7', hcLight: '#652D90' },
  localize('chartsPurple', 'The purple color used in chart visualizations.'),
);
