import { Injector } from '@opensumi/di';
import {
  isUndefinedOrNull,
  StorageProvider,
  IStorage,
  Event,
  Emitter,
  Disposable,
  URI,
} from '@opensumi/ide-core-common';

let mockedStorage: MockedStorage | null = null;

export const MockedStorageProvider: StorageProvider = async (storageId: URI) => {
  if (!mockedStorage) {
    mockedStorage = new MockedStorage();
  }
  return mockedStorage;
};

export class MockedStorage extends Disposable implements IStorage {
  items: Map<string, string> = new Map();

  get size(): number {
    return this.items.size;
  }

  _onDidChangeStorage: Emitter<string> = new Emitter<string>();
  onDidChangeStorage: Event<string> = this._onDidChangeStorage.event;
  whenReady: Promise<any>;

  async init(storageId: string): Promise<void | IStorage> {
    return this;
  }

  get(key: any, fallbackValue?: any) {
    const value = this.items.get(key);
    if (isUndefinedOrNull(value)) {
      return fallbackValue;
    }
    return value;
  }

  getBoolean(key: any, fallbackValue?: any) {
    const value = this.items.get(key);
    if (isUndefinedOrNull(value)) {
      return fallbackValue;
    }
    return value === 'true';
  }

  getNumber(key: string, fallbackValue: number): number;
  getNumber(key: string, fallbackValue?: number | undefined): number | undefined;
  getNumber(key: any, fallbackValue?: any) {
    const value = this.items.get(key);
    if (isUndefinedOrNull(value)) {
      return fallbackValue;
    }
    return parseInt(value, 10);
  }

  async set(key: string, value: any): Promise<void> {
    this.items.set(key, value);
    this._onDidChangeStorage.fire(key);
  }

  async delete(key: string): Promise<void> {
    this.items.delete(key);
  }

  async close(): Promise<void> {
    return;
  }

  async reConnectInit(): Promise<void> {
    return;
  }
}

export function useMockStorage(injector: Injector) {
  injector.overrideProviders({
    token: StorageProvider,
    useValue: MockedStorageProvider,
  });
}
