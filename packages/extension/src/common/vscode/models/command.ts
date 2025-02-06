/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Some code copied and modified from https://github.com/microsoft/vscode/blob/main/src/vs/editor/common/languages.ts
export interface Command {
  id: string;
  title: string;
  tooltip?: string;
  arguments?: any[];
}

export namespace Command {
  /**
   * @internal
   */
  export function is(obj: any): obj is Command {
    if (!obj || typeof obj !== 'object') {
      return false;
    }
    return typeof (obj as Command).id === 'string' && typeof (obj as Command).title === 'string';
  }
}
