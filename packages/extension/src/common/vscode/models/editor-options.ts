/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Some code copied and modified from https://github.com/microsoft/vscode/blob/main/src/vs/editor/common/config/editorOptions.ts

export const enum RenderLineNumbersType {
  Off = 0,
  On = 1,
  Relative = 2,
  Interval = 3,
  Custom = 4,
}
