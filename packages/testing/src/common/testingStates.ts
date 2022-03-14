/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { marked } from 'marked';

import { count } from '@opensumi/ide-core-common';

import { ITestErrorMessage, TestResultState } from './testCollection';

export interface TreeStateNode {
  statusNode: true;
  state: TestResultState;
  priority: number;
}

/**
 * List of display priorities for different run states. When tests update,
 * the highest-priority state from any of their children will be the state
 * reflected in the parent node.
 */
export const statePriority: { [K in TestResultState]: number } = {
  [TestResultState.Running]: 6,
  [TestResultState.Errored]: 5,
  [TestResultState.Failed]: 4,
  [TestResultState.Queued]: 3,
  [TestResultState.Passed]: 2,
  [TestResultState.Unset]: 1,
  [TestResultState.Skipped]: 0,
};

export const isFailedState = (s: TestResultState) => s === TestResultState.Errored || s === TestResultState.Failed;
export const isStateWithResult = (s: TestResultState) =>
  s === TestResultState.Errored || s === TestResultState.Failed || s === TestResultState.Passed;

export const stateNodes = Object.entries(statePriority).reduce((acc, [stateStr, priority]) => {
  const state = Number(stateStr) as TestResultState;
  acc[state] = { statusNode: true, state, priority };
  return acc;
}, {} as { [K in TestResultState]: TreeStateNode });

export const cmpPriority = (a: TestResultState, b: TestResultState) => statePriority[b] - statePriority[a];

export const maxPriority = (...states: TestResultState[]) => {
  switch (states.length) {
    case 0:
      return TestResultState.Unset;
    case 1:
      return states[0];
    case 2:
      return statePriority[states[0]] > statePriority[states[1]] ? states[0] : states[1];
    default: {
      let max = states[0];
      for (let i = 1; i < states.length; i++) {
        if (statePriority[max] < statePriority[states[i]]) {
          max = states[i];
        }
      }
      return max;
    }
  }
};

export const statesInOrder = Object.keys(statePriority)
  .map((s) => Number(s) as TestResultState)
  .sort(cmpPriority);

export const isRunningState = (s: TestResultState) => s === TestResultState.Queued || s === TestResultState.Running;

export const firstLine = (str: string) => {
  const index = str.indexOf('\n');
  return index === -1 ? str : str.slice(0, index);
};

const domParser = new DOMParser();

export const parseMarkdownText = (value: string) =>
  domParser.parseFromString(marked.parse(value), 'text/html').documentElement.outerText;

export const isDiffable = (
  message: ITestErrorMessage,
): message is ITestErrorMessage & { actualOutput: string; expectedOutput: string } =>
  message.actual !== undefined && message.expected !== undefined;

const hintPeekStrHeight = (str: string | undefined) => Math.min(Math.max(count(str || '', '\n') + 3, 8), 20);

export const hintMessagePeekHeight = (msg: ITestErrorMessage) =>
  isDiffable(msg)
    ? Math.max(hintPeekStrHeight(msg.actual), hintPeekStrHeight(msg.expected))
    : hintPeekStrHeight(typeof msg.message === 'string' ? msg.message : msg.message.value);
