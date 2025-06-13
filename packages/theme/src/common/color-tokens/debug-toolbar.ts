import { registerColor } from '../utils';

// ref: https://github.com/Microsoft/vscode/blob/b07d19a768b42af2aa8f78f8b1b68978f14f9bd9/src%2Fvs%2Fworkbench%2Fcontrib%2Fdebug%2Fbrowser%2FdebugToolBar.ts
export const debugToolBarBackground = registerColor(
  'debugToolBar.background',
  {
    dark: '#333333',
    light: '#F3F3F3',
    hcDark: '#000000',
    hcLight: '#FFFFFF',
  },
  'Debug toolbar background color.',
);

export const debugToolBarBorder = registerColor(
  'debugToolBar.border',
  {
    dark: null,
    light: null,
    hcDark: null,
    hcLight: null,
  },
  'Debug toolbar border color.',
);

export const debugIconStartForeground = registerColor(
  'debugIcon.startForeground',
  {
    dark: '#89D185',
    light: '#388A34',
    hcDark: '#89D185',
    hcLight: '#388A34',
  },
  'Debug toolbar icon for start debugging.',
);

export const debugIconPauseForeground = registerColor(
  'debugIcon.pauseForeground',
  {
    dark: '#75BEFF',
    light: '#007ACC',
    hcDark: '#75BEFF',
    hcLight: '#007ACC',
  },
  'Debug toolbar icon for pause.',
);

export const debugIconStopForeground = registerColor(
  'debugIcon.stopForeground',
  {
    dark: '#F48771',
    light: '#A1260D',
    hcDark: '#F48771',
    hcLight: '#A1260D',
  },
  'Debug toolbar icon for stop.',
);

export const debugIconDisconnectForeground = registerColor(
  'debugIcon.disconnectForeground',
  {
    dark: '#F48771',
    light: '#A1260D',
    hcDark: '#F48771',
    hcLight: '#A1260D',
  },
  'Debug toolbar icon for disconnect.',
);

export const debugIconRestartForeground = registerColor(
  'debugIcon.restartForeground',
  {
    dark: '#89D185',
    light: '#388A34',
    hcDark: '#89D185',
    hcLight: '#388A34',
  },
  'Debug toolbar icon for restart.',
);

export const debugIconStepOverForeground = registerColor(
  'debugIcon.stepOverForeground',
  {
    dark: '#75BEFF',
    light: '#007ACC',
    hcDark: '#75BEFF',
    hcLight: '#007ACC',
  },
  'Debug toolbar icon for step over.',
);

export const debugIconStepIntoForeground = registerColor(
  'debugIcon.stepIntoForeground',
  {
    dark: '#75BEFF',
    light: '#007ACC',
    hcDark: '#75BEFF',
    hcLight: '#007ACC',
  },
  'Debug toolbar icon for step into.',
);

export const debugIconStepOutForeground = registerColor(
  'debugIcon.stepOutForeground',
  {
    dark: '#75BEFF',
    light: '#007ACC',
    hcDark: '#75BEFF',
    hcLight: '#007ACC',
  },
  'Debug toolbar icon for step over.',
);

export const debugIconContinueForeground = registerColor(
  'debugIcon.continueForeground',
  {
    dark: '#75BEFF',
    light: '#007ACC',
    hcDark: '#75BEFF',
    hcLight: '#007ACC',
  },
  'Debug toolbar icon for continue.',
);

export const debugIconStepBackForeground = registerColor(
  'debugIcon.stepBackForeground',
  {
    dark: '#75BEFF',
    light: '#007ACC',
    hcDark: '#75BEFF',
    hcLight: '#007ACC',
  },
  'Debug toolbar icon for step back.',
);

export const debugIconActivateBreakpointsForeground = registerColor(
  'debugIcon.activateBreakpointsForeground',
  {
    dark: '#75BEFF',
    light: '#007ACC',
    hcDark: '#75BEFF',
    hcLight: '#007ACC',
  },
  'Debug toolbar icon for active breakpoints.',
);
