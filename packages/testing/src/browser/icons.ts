import { getExternalIcon } from '@opensumi/ide-core-browser';
import { TestResultState } from '../common/testCollection';

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
