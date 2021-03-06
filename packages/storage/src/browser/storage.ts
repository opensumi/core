import { AppConfig, StorageService } from '@opensumi/ide-core-browser';
import {
  getDebugLogger,
  IStorage,
  ThrottledDelayer,
  isUndefinedOrNull,
  Emitter,
  Event,
  DisposableCollection,
  Deferred,
} from '@opensumi/ide-core-common';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IStorageServer, IUpdateRequest } from '../common';

enum StorageState {
  None,
  Initialized,
  Closed,
}

export class Storage implements IStorage {
  private static readonly DEFAULT_FLUSH_DELAY = 200;

  private _onDidChangeStorage = new Emitter<string>();
  readonly onDidChangeStorage: Event<string> = this._onDidChangeStorage.event;

  private flushDelayer: ThrottledDelayer<void>;

  private state = StorageState.None;

  private cache: Map<string, string> = new Map<string, string>();

  private pendingDeletes: Set<string> = new Set();
  private pendingInserts: Map<string, string> = new Map();

  private toDisposableCollection: DisposableCollection = new DisposableCollection();
  private readonly logger = getDebugLogger();

  private readyDeferred = new Deferred<void>();
  private whenReadyToWriteDeferred = new Deferred<void>();

  constructor(
    private readonly database: IStorageServer,
    private readonly workspace: IWorkspaceService,
    private readonly appConfig: AppConfig,
    private readonly storageName: string,
    private readonly browserLocalStorage?: StorageService,
  ) {
    this.toDisposableCollection.push(this._onDidChangeStorage);
    this.toDisposableCollection.push(
      this.workspace.onWorkspaceChanged(() => {
        this.setup(storageName);
      }),
    );
    this.flushDelayer = new ThrottledDelayer(Storage.DEFAULT_FLUSH_DELAY);
    this.setup(storageName);
  }

  get whenReady() {
    return this.readyDeferred.promise;
  }

  get whenReadyToWrite() {
    return this.whenReadyToWriteDeferred.promise;
  }

  get items(): Map<string, string> {
    return this.cache;
  }

  get size(): number {
    return this.cache.size;
  }

  async init(storageName: string) {
    const workspace = this.workspace.workspace;
    let cache;
    if (this.browserLocalStorage) {
      cache = await this.browserLocalStorage.getData(storageName);
    }
    if (!cache) {
      await this.database.init(this.appConfig.storageDirName, workspace && workspace.uri);
      cache = await this.database.getItems(storageName);
      if (this.browserLocalStorage) {
        this.browserLocalStorage.setData(storageName, cache);
      }
      this.whenReadyToWriteDeferred.resolve();
    } else {
      // ????????????????????????
      this.database.init(this.appConfig.storageDirName, workspace && workspace.uri).then(() => {
        this.database.getItems(storageName).then(async (data) => {
          // ???????????????????????????????????????????????????????????????????????????????????????
          this.cache = this.jsonToMap(data);
          if (this.browserLocalStorage) {
            await this.browserLocalStorage.setData(storageName, JSON.stringify(data));
          }
          this.whenReadyToWriteDeferred.resolve();
        });
      });
    }
    this.cache = this.jsonToMap(cache);
    this.state = StorageState.Initialized;
    this.readyDeferred.resolve();
  }

  setup(storageName: string) {
    this.init(storageName);
  }

  async reConnectInit() {
    this.readyDeferred = new Deferred();
    this.setup(this.storageName);
  }

  dispose() {
    this.toDisposableCollection.dispose();
  }

  get(key: string, fallbackValue: string): string;
  get(key: string, fallbackValue?: string): string | undefined;
  get(key: string, fallbackValue?: string): string | undefined {
    let value = this.cache.get(key);
    if (isUndefinedOrNull(value)) {
      return fallbackValue;
    }
    try {
      value = JSON.parse(value);
    } catch (e) {
      this.logger.error('Could not parse value: ', value, e);
    }
    return value;
  }

  getBoolean(key: string, fallbackValue: boolean): boolean;
  getBoolean(key: string, fallbackValue?: boolean): boolean | undefined;
  getBoolean(key: string, fallbackValue?: boolean): boolean | undefined {
    const value = this.get(key);

    if (isUndefinedOrNull(value)) {
      return fallbackValue;
    }

    return value === 'true';
  }

  getNumber(key: string, fallbackValue: number): number;
  getNumber(key: string, fallbackValue?: number): number | undefined;
  getNumber(key: string, fallbackValue?: number): number | undefined {
    const value = this.get(key);

    if (isUndefinedOrNull(value)) {
      return fallbackValue;
    }

    return parseInt(value, 10);
  }

  set(key: string, value: object | string | boolean | number | null | undefined): Promise<void> {
    if (this.state === StorageState.Closed) {
      return Promise.resolve();
    }

    // ????????????undefined???null??????
    if (isUndefinedOrNull(value)) {
      return this.delete(key);
    }

    // ??????????????????string?????????
    const valueStr = JSON.stringify(value);

    // ???????????????????????????????????????
    const currentValue = this.cache.get(key);
    if (currentValue === valueStr) {
      return Promise.resolve();
    }

    // ????????????????????????
    this.cache.set(key, valueStr);
    this.pendingInserts.set(key, valueStr);
    this.pendingDeletes.delete(key);

    // Event
    this._onDidChangeStorage.fire(key);

    // ????????????????????????????????????????????????
    return this.flushDelayer.trigger(() => this.flushPending());
  }

  delete(key: string): Promise<void> {
    if (this.state === StorageState.Closed) {
      return Promise.resolve();
    }

    // ??????????????????????????????????????????
    const wasDeleted = this.cache.delete(key);
    if (!wasDeleted) {
      return Promise.resolve();
    }

    if (!this.pendingDeletes.has(key)) {
      this.pendingDeletes.add(key);
    }

    this.pendingInserts.delete(key);

    // ????????????
    this._onDidChangeStorage.fire(key);

    // ????????????????????????????????????????????????
    return this.flushDelayer.trigger(() => this.flushPending());
  }

  async close(): Promise<void> {
    if (this.state === StorageState.Closed) {
      return Promise.resolve();
    }

    // ????????????
    this.state = StorageState.Closed;

    // ????????????????????????????????????????????????????????????
    // ?????????????????????????????????????????????????????????????????????????????????????????????
    //
    // ??????: ???????????????????????????????????????????????????????????????????????????
    try {
      await this.flushDelayer.trigger(() => this.flushPending(), 0);
    } catch (error) {
      // Ignore
    }

    await this.database.close(() => this.cache);
  }

  private async flushPending(): Promise<void> {
    await this.whenReadyToWrite;
    if (this.pendingInserts.size === 0 && this.pendingDeletes.size === 0) {
      return Promise.resolve();
    }

    // ???????????????????????????
    const updateRequest: IUpdateRequest = {
      insert: this.mapToJson(this.pendingInserts),
      delete: Array.from(this.pendingDeletes),
    };
    // ????????? LocalStroage ?????????????????????
    if (this.browserLocalStorage) {
      let cache = this.mapToJson(this.cache);
      for (const del of updateRequest?.delete || []) {
        delete cache[del];
      }
      cache = {
        ...cache,
        ...updateRequest.insert,
      };
      await this.browserLocalStorage.setData(this.storageName, cache);
    }

    // ????????????????????????????????????
    this.pendingDeletes = new Set<string>();
    this.pendingInserts = new Map<string, string>();

    // ????????????
    return this.database.updateItems(this.storageName, updateRequest);
  }

  private mapToJson(map: Map<string, string>) {
    const obj = Object.create(null);
    for (const [k, v] of map) {
      obj[k] = v;
    }
    return obj;
  }

  private jsonToMap(json: string | any) {
    if (typeof json === 'string') {
      try {
        json = JSON.parse(json);
      } catch (e) {
        this.logger.debug(e);
        return json;
      }
    }
    const itemsMap: Map<string, string> = new Map();
    for (const key of Object.keys(json)) {
      itemsMap.set(key, json[key]);
    }
    return itemsMap;
  }
}
