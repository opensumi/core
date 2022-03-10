/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Schemas } from '@opensumi/ide-core-common';

import { IExtHostFileSystemInfoShape } from '../../../common/vscode/file-system';

export class ExtHostFileSystemInfo implements IExtHostFileSystemInfoShape {
  declare readonly _serviceBrand: undefined;

  private readonly _systemSchemes = new Set(Object.keys(Schemas));
  private readonly _providerInfo = new Map<string, number>();

  $acceptProviderInfos(scheme: string, capabilities: number | null): void {
    if (capabilities === null) {
      this._providerInfo.delete(scheme);
    } else {
      this._providerInfo.set(scheme, capabilities);
    }
  }

  isFreeScheme(scheme: string): boolean {
    return !this._providerInfo.has(scheme) && !this._systemSchemes.has(scheme);
  }

  getCapabilities(scheme: string): number | undefined {
    return this._providerInfo.get(scheme);
  }
}
