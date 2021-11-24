/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// modified by https://github.com/microsoft/vscode/blob/f90a0abe02b932182bd72d689ce5dd0836583493/src/vs/workbench/services/keybinding/browser/keyboardLayouts/_.contribution.ts

import { IKeymapInfo } from '@opensumi/ide-core-common';

export class KeyboardLayoutContribution {
  public static readonly INSTANCE: KeyboardLayoutContribution = new KeyboardLayoutContribution();

  private _layoutInfos: IKeymapInfo[] = [];

  get layoutInfos() {
    return this._layoutInfos;
  }

  private constructor() {
  }

  registerKeyboardLayout(layout: IKeymapInfo) {
    this._layoutInfos.push(layout);
  }
}
