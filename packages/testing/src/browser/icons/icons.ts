import { localize } from '@opensumi/ide-core-common';
import { getExternalIcon } from '@opensumi/ide-core-browser';
import { registerColor } from '@opensumi/ide-theme';
import { TestResultState } from '../../common/testCollection';

export const defaultIconColor = 'sumi_testing_icon_iconPassed';

export const testStatesToIconColors: { [K in TestResultState]?: string } = {
  [TestResultState.Errored]: 'sumi_testing_icon_iconFailed',
  [TestResultState.Failed]: 'sumi_testing_icon_iconErrored',
  [TestResultState.Passed]: defaultIconColor,
  [TestResultState.Queued]: 'sumi_testing_icon_iconQueued',
  [TestResultState.Unset]: 'sumi_testing_icon_iconUnset',
  [TestResultState.Skipped]: 'sumi_testing_icon_iconUnset',
};

export const testingStatesToIcons = new Map<TestResultState, string>([
  [TestResultState.Errored, getExternalIcon('issues')],
  [TestResultState.Failed, getExternalIcon('error')],
  [TestResultState.Passed, getExternalIcon('pass')],
  [TestResultState.Queued, getExternalIcon('history')],
  [TestResultState.Running, getExternalIcon('loading')],
  [TestResultState.Skipped, getExternalIcon('debug-step-over')],
  [TestResultState.Unset, getExternalIcon('circle-outline')],
]);

export const testingRunIcon = getExternalIcon('run');
export const testingRunAllIcon = getExternalIcon('run-all');

export const testingColorIconFailed = registerColor(
  'testing.iconFailed',
  {
    dark: '#f14c4c',
    light: '#f14c4c',
    hc: '#000000',
  },
  localize('testing.iconFailed', "Color for the 'failed' icon in the test explorer."),
);

export const testingColorIconErrored = registerColor(
  'testing.iconErrored',
  {
    dark: '#f14c4c',
    light: '#f14c4c',
    hc: '#000000',
  },
  localize('testing.iconErrored', "Color for the 'Errored' icon in the test explorer."),
);

export const testingColorIconPassed = registerColor(
  'testing.iconPassed',
  {
    dark: '#73c991',
    light: '#73c991',
    hc: '#000000',
  },
  localize('testing.iconPassed', "Color for the 'passed' icon in the test explorer."),
);

export const testingColorRunAction = registerColor(
  'testing.runAction',
  {
    dark: testingColorIconPassed,
    light: testingColorIconPassed,
    hc: testingColorIconPassed,
  },
  localize('testing.runAction', "Color for 'run' icons in the editor."),
);

export const testingColorIconQueued = registerColor(
  'testing.iconQueued',
  {
    dark: '#cca700',
    light: '#cca700',
    hc: '#000000',
  },
  localize('testing.iconQueued', "Color for the 'Queued' icon in the test explorer."),
);

export const testingColorIconUnset = registerColor(
  'testing.iconUnset',
  {
    dark: '#848484',
    light: '#848484',
    hc: '#848484',
  },
  localize('testing.iconUnset', "Color for the 'Unset' icon in the test explorer."),
);

export const testingColorIconSkipped = registerColor(
  'testing.iconSkipped',
  {
    dark: '#848484',
    light: '#848484',
    hc: '#848484',
  },
  localize('testing.iconSkipped', "Color for the 'Skipped' icon in the test explorer."),
);
