/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BinaryBuffer } from '@opensumi/ide-core-common';

import { IDataTransferItem, VSDataTransfer } from './data-transfer';

// Modified from https://github.com/microsoft/vscode/blob/f86ceb6749721ca068f0407914521ad11ca704a8/src/vs/workbench/api/common/shared/dataTransferCache.ts

export class DataTransferCache {
  private requestIdPool = 0;
  private readonly dataTransfers = new Map</* requestId */ number, ReadonlyArray<IDataTransferItem>>();

  public add(dataTransfer: VSDataTransfer): { id: number; dispose: () => void } {
    const requestId = this.requestIdPool++;
    this.dataTransfers.set(requestId, [...dataTransfer.values()]);
    return {
      id: requestId,
      dispose: () => {
        this.dataTransfers.delete(requestId);
      },
    };
  }

  async resolveDropFileData(requestId: number, dataItemId: string): Promise<BinaryBuffer> {
    const entry = this.dataTransfers.get(requestId);
    if (!entry) {
      throw new Error('No data transfer found');
    }

    const item = entry.find((x) => x.id === dataItemId);
    if (!item) {
      throw new Error('No item found in data transfer');
    }

    const file = item.asFile();
    if (!file) {
      throw new Error('Found data transfer item is not a file');
    }

    return BinaryBuffer.wrap(await file.data());
  }

  dispose() {
    this.dataTransfers.clear();
  }
}
