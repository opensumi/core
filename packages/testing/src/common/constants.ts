/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '@opensumi/ide-core-common';

import { TestMessageType, TestResultState, TestRunProfileBitset } from './testCollection';

export const enum Testing {
  // marked as "extension" so that any existing test extensions are assigned to it.
  ViewletId = 'workbench.view.extension.test',
  ExplorerViewId = 'workbench.view.testing',
  OutputPeekContributionId = 'editor.contrib.testingOutputPeek',
  DecorationsContributionId = 'editor.contrib.testingDecorations',
  FilterActionId = 'workbench.actions.treeView.testExplorer.filter',
}

export const enum TestExplorerViewMode {
  List = 'list',
  Tree = 'true',
}

export const enum TestExplorerViewSorting {
  ByLocation = 'location',
  ByStatus = 'status',
}

export const enum TestExplorerStateFilter {
  OnlyFailed = 'failed',
  OnlyExecuted = 'excuted',
  All = 'all',
}

export const testStateNames: { [K in TestResultState]: string } = {
  [TestResultState.Errored]: localize('testState.errored', 'Errored'),
  [TestResultState.Failed]: localize('testState.failed', 'Failed'),
  [TestResultState.Passed]: localize('testState.passed', 'Passed'),
  [TestResultState.Queued]: localize('testState.queued', 'Queued'),
  [TestResultState.Running]: localize('testState.running', 'Running'),
  [TestResultState.Skipped]: localize('testState.skipped', 'Skipped'),
  [TestResultState.Unset]: localize('testState.unset', 'Not yet run'),
};

export const labelForTestInState = (label: string, state: TestResultState) =>
  'label then the unit tests state, for example "Addition Tests (Running)"';

export const testConfigurationGroupNames: { [K in TestRunProfileBitset]: string } = {
  [TestRunProfileBitset.Debug]: localize('testGroup.debug', 'Debug'),
  [TestRunProfileBitset.Run]: localize('testGroup.run', 'Run'),
  [TestRunProfileBitset.Coverage]: localize('testGroup.coverage', 'Coverage'),
};

export const testMessageSeverityColors = {
  [TestMessageType.Error]: '#F14C4C',
  [TestMessageType.Info]: '#33333380', // --> #333333 透明度 0.5 的结果
};
