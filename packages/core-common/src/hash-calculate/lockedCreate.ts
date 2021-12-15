/* ---------------------------------------------------------------------------------------------
 * MIT License Copyright (c) 2020 Dani All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * https://github.com/Daninet/hash-wasm
 *--------------------------------------------------------------------------------------------*/

// copy and modified from https://github.com/Daninet/hash-wasm/blob/bd3a205ca5603fc80adf71d0966fc72e8d4fa0ef/lib/lockedCreate.ts

import { Mutex } from './mutex';
import { WASMInterface, IWASMInterface } from './WASMInterface';

export async function lockedCreate(mutex: Mutex, binary: any, hashLength: number): Promise<IWASMInterface> {
  const unlock = await mutex.lock();
  const wasm = await WASMInterface(binary, hashLength);
  unlock();
  return wasm;
}
