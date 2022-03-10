import { IRPCProtocol } from '@opensumi/ide-connection';
import { Emitter, IDisposable } from '@opensumi/ide-core-common';
import { ExtensionStorageUri } from '@opensumi/ide-extension-storage/lib/common/storage';

import {
  IMainThreadStorage,
  IExtHostStorage,
  KeysToAnyValues,
  KeysToKeysToAnyValue,
  MainThreadAPIIdentifier,
} from '../../../common/vscode';
import { Memento } from '../../../common/vscode/ext-types';

export interface IStorageChangeEvent {
  shared: boolean;
  data: KeysToAnyValues;
}

export class ExtHostStorage implements IExtHostStorage {
  private _onDidChangeStorage = new Emitter<IStorageChangeEvent>();
  readonly onDidChangeStorage = this._onDidChangeStorage.event;
  private proxy: IMainThreadStorage;
  private _storagePath: ExtensionStorageUri;

  constructor(rpc: IRPCProtocol) {
    this.proxy = rpc.getProxy(MainThreadAPIIdentifier.MainThreadStorage);
  }

  get storagePath() {
    return this._storagePath;
  }

  async getValue<T>(shared: boolean, key: string, defaultValue?: T): Promise<T | KeysToAnyValues> {
    return this.proxy.$getValue(shared, key).then((value) => value || defaultValue);
  }

  async setValue(shared: boolean, key: string, value: object): Promise<void> {
    return this.proxy.$setValue(shared, key, value);
  }

  async $updateWorkspaceStorageData(data: KeysToKeysToAnyValue) {
    this._onDidChangeStorage.fire({ shared: false, data });
  }

  async $acceptStoragePath(paths: ExtensionStorageUri) {
    this._storagePath = paths;
  }
}

export class ExtensionMemento implements Memento {
  private readonly _init: Promise<ExtensionMemento>;
  private cache: { [n: string]: any };
  private readonly storageListener: IDisposable;

  constructor(private readonly id: string, private readonly global: boolean, private readonly storage: ExtHostStorage) {
    this._init = this.storage.getValue(this.global, this.id, Object.create(null)).then((value) => {
      this.cache = value;
      return this;
    });

    this.storageListener = this.storage.onDidChangeStorage((e) => {
      if (e.shared === this.global) {
        this.cache = e.data[this.id] || {};
      }
    });
  }

  get keys() {
    return Object.keys(this.cache);
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

export class ExtensionGlobalMemento extends ExtensionMemento {
  setKeysForSync() {
    // TODO: 目前 IDE 都会同步配置，该方法先空实现
  }
}
