import { registerColor } from '../color-registry';

// ref: https://github.com/Microsoft/vscode/blob/b07d19a768b42af2aa8f78f8b1b68978f14f9bd9/src%2Fvs%2Fworkbench%2Fcontrib%2Fdebug%2Fbrowser%2FdebugToolBar.ts
export const debugToolBarBackground = registerColor(
  'debugToolBar.background',
  {
    dark: '#333333',
    light: '#F3F3F3',
    hc: '#000000',
  },
  'Debug toolbar background color.',
);

export const debugToolBarBorder = registerColor(
  'debugToolBar.border',
  {
    dark: null,
    light: null,
    hc: null,
  },
  'Debug toolbar border color.',
);

export const debugIconStartForeground = registerColor(
  'debugIcon.startForeground',
  {
    dark: '#89D185',
    light: '#388A34',
    hc: '#89D185',
  },
  'Debug toolbar icon for start debugging.',
);

export const debugIconPauseForeground = registerColor(
  'debugIcon.pauseForeground',
  {
    dark: '#75BEFF',
    light: '#007ACC',
    hc: '#75BEFF',
  },
  'Debug toolbar icon for pause.',
);

export const debugIconStopForeground = registerColor(
  'debugIcon.stopForeground',
  {
    dark: '#F48771',
    light: '#A1260D',
    hc: '#F48771',
  },
  'Debug toolbar icon for stop.',
);

export const debugIconDisconnectForeground = registerColor(
  'debugIcon.disconnectForeground',
  {
    dark: '#F48771',
    light: '#A1260D',
    hc: '#F48771',
  },
  'Debug toolbar icon for disconnect.',
);

export const debugIconRestartForeground = registerColor(
  'debugIcon.restartForeground',
  {
    dark: '#89D185',
    light: '#388A34',
    hc: '#89D185',
  },
  'Debug toolbar icon for restart.',
);

export const debugIconStepOverForeground = registerColor(
  'debugIcon.stepOverForeground',
  {
    dark: '#75BEFF',
    light: '#007ACC',
    hc: '#75BEFF',
  },
  'Debug toolbar icon for step over.',
);

export const debugIconStepIntoForeground = registerColor(
  'debugIcon.stepIntoForeground',
  {
    dark: '#75BEFF',
    light: '#007ACC',
    hc: '#75BEFF',
  },
  'Debug toolbar icon for step into.',
);

export const debugIconStepOutForeground = registerColor(
  'debugIcon.stepOutForeground',
  {
    dark: '#75BEFF',
    light: '#007ACC',
    hc: '#75BEFF',
  },
  'Debug toolbar icon for step over.',
);

export const debugIconContinueForeground = registerColor(
  'debugIcon.continueForeground',
  {
    dark: '#75BEFF',
    light: '#007ACC',
    hc: '#75BEFF',
  },
  'Debug toolbar icon for continue.',
);

export const debugIconStepBackForeground = registerColor(
  'debugIcon.stepBackForeground',
  {
    dark: '#75BEFF',
    light: '#007ACC',
    hc: '#75BEFF',
  },
  'Debug toolbar icon for step back.',
);
