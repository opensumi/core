import { localize } from '@opensumi/ide-core-common';

import { transparent, registerColor } from '../utils';

import { contrastBorder } from './base';
import { editorErrorForeground } from './editor';

export const testingColorIconFailed = registerColor(
  'testing.iconFailed',
  {
    dark: '#f14c4c',
    light: '#f14c4c',
    hcDark: '#f14c4c',
    hcLight: '#B5200D',
  },
  localize('testing.iconFailed', "Color for the 'failed' icon in the test explorer."),
);

export const testingColorIconErrored = registerColor(
  'testing.iconErrored',
  {
    dark: '#f14c4c',
    light: '#f14c4c',
    hcDark: '#f14c4c',
    hcLight: '#B5200D',
  },
  localize('testing.iconErrored', "Color for the 'Errored' icon in the test explorer."),
);

export const testingColorIconPassed = registerColor(
  'testing.iconPassed',
  {
    dark: '#73c991',
    light: '#73c991',
    hcDark: '#73c991',
    hcLight: '#007100',
  },
  localize('testing.iconPassed', "Color for the 'passed' icon in the test explorer."),
);

export const testingColorRunAction = registerColor(
  'testing.runAction',
  {
    dark: testingColorIconPassed,
    light: testingColorIconPassed,
    hcDark: testingColorIconPassed,
    hcLight: testingColorIconPassed,
  },
  localize('testing.runAction', "Color for 'run' icons in the editor."),
);

export const testingColorIconQueued = registerColor(
  'testing.iconQueued',
  {
    dark: '#cca700',
    light: '#cca700',
    hcDark: '#cca700',
    hcLight: '#cca700',
  },
  localize('testing.iconQueued', "Color for the 'Queued' icon in the test explorer."),
);

export const testingColorIconUnset = registerColor(
  'testing.iconUnset',
  {
    dark: '#848484',
    light: '#848484',
    hcDark: '#848484',
    hcLight: '#848484',
  },
  localize('testing.iconUnset', "Color for the 'Unset' icon in the test explorer."),
);

export const testingColorIconSkipped = registerColor(
  'testing.iconSkipped',
  {
    dark: '#848484',
    light: '#848484',
    hcDark: '#848484',
    hcLight: '#848484',
  },
  localize('testing.iconSkipped', "Color for the 'Skipped' icon in the test explorer."),
);

export const testingPeekBorder = registerColor(
  'testing.peekBorder',
  {
    dark: editorErrorForeground,
    light: editorErrorForeground,
    hcDark: contrastBorder,
    hcLight: contrastBorder,
  },
  localize('testing.peekBorder', 'Color of the peek view borders and arrow.'),
);

export const testingPeekHeaderBackground = registerColor(
  'testing.peekHeaderBackground',
  {
    dark: transparent(editorErrorForeground, 0.1),
    light: transparent(editorErrorForeground, 0.1),
    hcDark: null,
    hcLight: null,
  },
  localize('testing.peekBorder', 'Color of the peek view borders and arrow.'),
);
