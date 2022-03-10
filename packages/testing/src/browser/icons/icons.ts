import { getExternalIcon } from '@opensumi/ide-core-browser';

import { TestResultState } from '../../common/testCollection';

export const defaultIconColor = 'testing_icon_iconPassed';

export const testStatesToIconColors: { [K in TestResultState]?: string } = {
  [TestResultState.Errored]: 'testing_icon_iconFailed',
  [TestResultState.Failed]: 'testing_icon_iconErrored',
  [TestResultState.Passed]: defaultIconColor,
  [TestResultState.Queued]: 'testing_icon_iconQueued',
  [TestResultState.Unset]: 'testing_icon_iconUnset',
  [TestResultState.Skipped]: 'testing_icon_iconUnset',
};

export const testingStatesToIcons = new Map<TestResultState, string>([
  [TestResultState.Errored, getExternalIcon('issues')],
  [TestResultState.Failed, getExternalIcon('error')],
  [TestResultState.Passed, getExternalIcon('pass')],
  [TestResultState.Queued, getExternalIcon('history')],
  [TestResultState.Running, getExternalIcon('loading') + ' kt-icon-loading'],
  [TestResultState.Skipped, getExternalIcon('debug-step-over')],
  [TestResultState.Unset, getExternalIcon('circle-outline')],
]);

export const testingRunIcon = getExternalIcon('run');
export const testingRunAllIcon = getExternalIcon('run-all');

export const getIconWithColor = (state: TestResultState) =>
  `${testingStatesToIcons.get(state)} ${testStatesToIconColors[state]}` || '';
