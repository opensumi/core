/// <reference path="./../typings/vscode.editor.d.ts" />
/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export type ProviderResult<T> = T | undefined | null | Thenable<T | undefined | null>;

declare module 'vscode' {
  /**
   * Defines a port mapping used for localhost inside the webview.
   */
  export interface WebviewPortMapping {
    /**
     * Localhost port to remap inside the webview.
     */
    readonly webviewPort: number;

    /**
     * Destination port. The `webviewPort` is resolved to this port.
     */
    readonly extensionHostPort: number;
  }

  // #endregion
}
