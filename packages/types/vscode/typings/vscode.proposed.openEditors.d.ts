/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'vscode' {

	// https://github.com/Microsoft/vscode/issues/15178

  // TODO@API must be a class
  export interface OpenEditorInfo {
    name: string;
    resource: Uri;
    isActive: boolean;
  }

  export namespace window {
    export const openEditors: ReadonlyArray<OpenEditorInfo>;

    // todo@API proper event type
    export const onDidChangeOpenEditors: Event<void>;
  }

  //#endregion

  export namespace extensions {
    /**
     * All extensions across all extension hosts.
     *
     * @see {@link Extension.isFromDifferentExtensionHost}
     */
    export const allAcrossExtensionHosts: readonly Extension<void>[];

  }
}
