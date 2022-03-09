/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ITextEditorOptions } from '@opensumi/monaco-editor-core/esm/vs/platform/editor/common/editor';

import { ITestResult } from './test-result';
import { TestResultItem } from './testCollection';

export const TestingPeekOpenerServiceToken = Symbol('TestingPeekOpenerService');

export interface ITestingPeekOpenerService {
  _serviceBrand: undefined;

  /**
   * Tries to peek the first test error, if the item is in a failed state.
   * @returns a boolean indicating whether a peek was opened
   */
  tryPeekFirstError(result: ITestResult, test: TestResultItem, options?: Partial<ITextEditorOptions>): boolean;

  /**
   * Opens the peek. Shows any available message.
   */
  open(): void;

  /**
   * Closes peeks for all visible editors.
   */
  closeAllPeeks(): void;
}
