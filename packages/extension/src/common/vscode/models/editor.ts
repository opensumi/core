/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Some code copied and modified from https://github.com/microsoft/vscode/blob/main/src/vs/editor/common/model.ts

/**
 * End of line character preference.
 */
export const enum EndOfLineSequence {
  /**
   * Use line feed (\n) as the end of line character.
   */
  LF = 0,
  /**
   * Use carriage return and line feed (\r\n) as the end of line character.
   */
  CRLF = 1,
}
