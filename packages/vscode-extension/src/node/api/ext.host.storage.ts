import * as vscode from 'vscode';
import { Emitter, IDisposable } from '@ali/ide-core-common';
import { IMainThreadStorage, IExtHostStorage, KeysToAnyValues, KeysToKeysToAnyValue, MainThreadAPIIdentifier } from '../../common';
import { IRPCProtocol } from '@ali/ide-connection';
import { Memento } from '../../common/ext-types';

export interface IStorageChangeEvent {
  shared: boolean;
  key: string;
  value: object;
}

export class ExtHostStorage implements IExtHostStorage {
  private _onDidChangeStorage = new Emitter<IStorageChangeEvent>();
  readonly onDidChangeStorage = this._onDidChangeStorage.event;
  private proxy: IMainThreadStorage;

  constructor(rpc: IRPCProtocol) {
    this.proxy = rpc.getProxy(MainThreadAPIIdentifier.MainThreadStorage);
  }

  async getValue<T>(shared: boolean, key: string, defaultValue?: T): Promise<T | KeysToAnyValues> {
    return this.proxy.$getValue(shared, key).then((value) => value || defaultValue);
  }

  async setValue(shared: boolean, key: string, value: object): Promise<void> {
    return this.proxy.$setValue(shared, key, value);
  }

  $acceptValue(shared: boolean, key: string, value: object): void {
    this._onDidChangeStorage.fire({ shared, key, value });
  }
}

export class ExtensionMemento implements Memento {

  private readonly _init: Promise<ExtensionMemento>;
  private cache: { [n: string]: any; };
  private readonly storageListener: IDisposable;

  constructor(
      private readonly id: string,
      private readonly global: boolean,
      private readonly storage: ExtHostStorage,
  ) {
    this._init = this.storage.getValue(this.global, this.id, Object.create(null)).then((value) => {
      this.cache = value;
      return this;
    });

    this.storageListener = this.storage.onDidChangeStorage((e) => {
      if (e.shared === this.global && e.key === this.id) {
        this.cache = e.value;
      }
    });
  }

  get whenReady(): Promise<ExtensionMemento> {
    return this._init;
  }

  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T {
    let value = this.cache[key];
    if (typeof value === 'undefined') {
      value = defaultValue;
    }
    return value;
  }

  update(key: string, value: any): Promise<void> {
    this.cache[key] = value;
    return this.storage.setValue(this.global, this.id, this.cache);
  }

  dispose(): void {
    this.storageListener.dispose();
  }
}
