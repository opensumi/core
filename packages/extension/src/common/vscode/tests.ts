/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Some code copied and modified from https://github.com/microsoft/vscode/tree/main/src/vs/workbench/contrib/testing/common

import type vscode from 'vscode';

import { CancellationToken } from '@opensumi/ide-core-common';
import {
  CoverageDetails,
  ExtensionRunTestsRequest,
  IFileCoverage,
  ILocationDto,
  ISerializedTestResults,
  ITestItem,
  ITestRunProfile,
  ITestRunTask,
  ResolvedTestRunRequest,
  RunTestForControllerRequest,
  SerializedTestMessage,
  TestResultState,
  TestsDiff,
} from '@opensumi/ide-testing/lib/common/testCollection';

export interface IExtHostTests {
  createTestController(controllerId: string, label: string): vscode.TestController;

  // #region API for main thread
  $runControllerTests(req: RunTestForControllerRequest, token: CancellationToken): Promise<void>;
  $cancelExtensionTestRun(runId: string | undefined): void;
  /** Handles a diff of tests, as a result of a subscribeToDiffs() call */
  $acceptDiff(diff: TestsDiff): void;
  /** Publishes that a test run finished. */
  $publishTestResults(results: ISerializedTestResults[]): void;
  /** Expands a test item's children, by the given number of levels. */
  $expandTest(testId: string, levels: number): Promise<void>;
  /** Requests file coverage for a test run. Errors if not available. */
  $provideFileCoverage(runId: string, taskId: string, token: CancellationToken): Promise<IFileCoverage[]>;
  /**
   * Requests coverage details for the file index in coverage data for the run.
   * Requires file coverage to have been previously requested via $provideFileCoverage.
   */
  $resolveFileCoverage(
    runId: string,
    taskId: string,
    fileIndex: number,
    token: CancellationToken,
  ): Promise<CoverageDetails[]>;
  /** Configures a test run config. */
  $configureRunProfile(controllerId: string, configId: number): void;
  // #endregion
}

export interface IMainThreadTesting {
  // --- test lifecycle:

  /** Registers that there's a test controller with the given ID */
  $registerTestController(controllerId: string, label: string): void;
  /** Updates the label of an existing test controller. */
  $updateControllerLabel(controllerId: string, label: string): void;
  /** Disposes of the test controller with the given ID */
  $unregisterTestController(controllerId: string): void;
  /** Requests tests published to VS Code. */
  $subscribeToDiffs(): void;
  /** Stops requesting tests published to VS Code. */
  $unsubscribeFromDiffs(): void;
  /** Publishes that new tests were available on the given source. */
  $publishDiff(controllerId: string, diff: TestsDiff): void;

  // --- test run configurations:

  /** Called when a new test run configuration is available */
  $publishTestRunProfile(config: ITestRunProfile): void;
  /** Updates an existing test run configuration */
  $updateTestRunConfig(controllerId: string, configId: number, update: Partial<ITestRunProfile>): void;
  /** Removes a previously-published test run config */
  $removeTestProfile(controllerId: string, configId: number): void;

  // --- test run handling:

  /** Request by an extension to run tests. */
  $runTests(req: ResolvedTestRunRequest, token: CancellationToken): Promise<string>;
  /**
   * Adds tests to the run. The tests are given in descending depth. The first
   * item will be a previously-known test, or a test root.
   */
  $addTestsToRun(controllerId: string, runId: string, tests: ITestItem[]): void;
  /** Updates the state of a test run in the given run. */
  $updateTestStateInRun(runId: string, taskId: string, testId: string, state: TestResultState, duration?: number): void;
  /** Appends a message to a test in the run. */
  $appendTestMessagesInRun(runId: string, taskId: string, testId: string, messages: SerializedTestMessage[]): void;
  /** Appends raw output to the test run.. */
  $appendOutputToRun(runId: string, taskId: string, output: string, location?: ILocationDto, testId?: string): void;
  /** Triggered when coverage is added to test results. */
  $signalCoverageAvailable(runId: string, taskId: string): void;
  /** Signals a task in a test run started. */
  $startedTestRunTask(runId: string, task: ITestRunTask): void;
  /** Signals a task in a test run ended. */
  $finishedTestRunTask(runId: string, taskId: string): void;
  /** Start a new extension-provided test run. */
  $startedExtensionTestRun(req: ExtensionRunTestsRequest): void;
  /** Signals that an extension-provided test run finished. */
  $finishedExtensionTestRun(runId: string): void;
}
