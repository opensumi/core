import { Injectable } from '@opensumi/di';

import { lockedCreate } from './lockedCreate';
import wasmJson from './md5.wasm.json';
import { Mutex } from './mutex';
import { IDataType } from './util';

export const IHashCalculateService = Symbol('IHashCalculateService');

export interface IHashCalculateService {
  initialize(): Promise<void>;

  calculate(content: IDataType): string;
}

type Awaited<T> = T extends PromiseLike<infer U> ? U : T;

type Calculator = Awaited<ReturnType<typeof lockedCreate>>;

function md5WasmCalculatorFactory() {
  const mutex = new Mutex();
  return lockedCreate(mutex, wasmJson, 16);
}

@Injectable()
export class HashCalculateServiceImpl implements IHashCalculateService {
  private cachedCalculator?: Calculator;

  private initialized = false;

  async initialize(): Promise<void> {
    if (!this.cachedCalculator) {
      this.cachedCalculator = await md5WasmCalculatorFactory();
    }
    this.initialized = true;
  }

  calculate(content: IDataType): string {
    if (!this.initialized) {
      throw new Error('Please call #initialize first!');
    }
    const hash = this.cachedCalculator!.calculate(content);
    return hash;
  }
}
