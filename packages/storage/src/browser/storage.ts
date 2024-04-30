import { AppConfig, StorageService } from '@opensumi/ide-core-browser';
import {
  Deferred,
  DisposableCollection,
  Emitter,
  Event,
  IStorage,
  ThrottledDelayer,
  URI,
  getDebugLogger,
  isUndefinedOrNull,
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
    private readonly isGlobal: boolean = true,
    private readonly browserLocalStorage?: StorageService,
  ) {
    this.toDisposableCollection.push(this._onDidChangeStorage);

    this.flushDelayer = new ThrottledDelayer(Storage.DEFAULT_FLUSH_DELAY);
    this.init(storageName).then(() => {
      this.toDisposableCollection.push(
        this.workspace.onWorkspaceChanged(() => {
          this.init(storageName);
        }),
      );
    });
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
    // 首次加载情况下，由于 Storage 不依赖 WorkspaceService 初始化逻辑
    // 在 `workspace` 不存在时，默认采用 `AppConfig` 内的 `workspaceDir` 配置值作为工作区路径
    const workspace = this.workspace.workspace?.uri || URI.file(this.appConfig.workspaceDir).toString();
    let cache;
    if (this.browserLocalStorage) {
      cache = await this.browserLocalStorage.getData(storageName);
    }
    if (!cache) {
      await this.database.init(this.appConfig.storageDirName, this.isGlobal ? undefined : workspace);
      cache = await this.database.getItems(storageName);
      if (this.browserLocalStorage) {
        this.browserLocalStorage.setData(storageName, cache);
      }
      this.whenReadyToWriteDeferred.resolve();
    } else {
      // 初始化服务端缓存
      this.database.init(this.appConfig.storageDirName, this.isGlobal ? undefined : workspace).then(() => {
        this.database.getItems(storageName).then(async (data) => {
          // 后续以服务端数据为准更新前端缓存数据，防止后续数据存取异常
          this.cache = this.jsonToMap(data);
          this.browserLocalStorage?.setData(storageName, data);
          this.whenReadyToWriteDeferred.resolve();
        });
      });
    }
    this.cache = this.jsonToMap(cache);
    this.state = StorageState.Initialized;
    this.readyDeferred.resolve();
  }

  async reConnectInit() {
    this.readyDeferred = new Deferred();
    this.init(this.storageName);
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

    // 移除值为undefined或null的值
    if (isUndefinedOrNull(value)) {
      return this.delete(key);
    }

    // 否则，转化为string并存储
    const valueStr = JSON.stringify(value);

    // 当值不发生改变是，提前结束
    const currentValue = this.cache.get(key);
    if (currentValue === valueStr) {
      return Promise.resolve();
    }

    // 更新缓存同时更新
    this.cache.set(key, valueStr);
    this.pendingInserts.set(key, valueStr);
    this.pendingDeletes.delete(key);

    // Event
    this._onDidChangeStorage.fire(key);

    // 按队列在空闲时期执行后台更新逻辑
    return this.flushDelayer.trigger(() => this.flushPending());
  }

  delete(key: string): Promise<void> {
    if (this.state === StorageState.Closed) {
      return Promise.resolve();
    }

    // 从缓存中移除并添加到后台队列
    const wasDeleted = this.cache.delete(key);
    if (!wasDeleted) {
      return Promise.resolve();
    }

    if (!this.pendingDeletes.has(key)) {
      this.pendingDeletes.add(key);
    }

    this.pendingInserts.delete(key);

    // 同步事件
    this._onDidChangeStorage.fire(key);

    // 按队列在空闲时期执行后台更新逻辑
    return this.flushDelayer.trigger(() => this.flushPending());
  }

  async close(): Promise<void> {
    if (this.state === StorageState.Closed) {
      return Promise.resolve();
    }

    // 更新状态
    this.state = StorageState.Closed;

    // 触发新的数据刷新动作确保数据在本地持久化
    // 即使刷新出错时也如此，必须确保数据库已经关闭以避免本地数据损坏
    //
    // 恢复: 在对应数据系统不健康时，我们将缓存作为恢复选项传递
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

    // 获取等待的队列数据
    const updateRequest: IUpdateRequest = {
      insert: this.mapToJson(this.pendingInserts),
      delete: Array.from(this.pendingDeletes),
    };
    // 同时在 LocalStorage 中同步缓存变化
    if (this.browserLocalStorage) {
      let cache = this.mapToJson(this.cache);
      for (const del of updateRequest?.delete || []) {
        delete cache[del];
      }
      cache = {
        ...cache,
        ...updateRequest.insert,
      };
      this.browserLocalStorage.setData(this.storageName, cache);
    }

    // 重置等待队列用于下次存储
    this.pendingDeletes = new Set<string>();
    this.pendingInserts = new Map<string, string>();

    // 更新数据
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
