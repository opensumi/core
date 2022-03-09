import { AppConfig } from '@opensumi/ide-core-browser';
import {
  getDebugLogger,
  IStorage,
  ThrottledDelayer,
  isUndefinedOrNull,
  Emitter,
  Event,
  DisposableCollection,
} from '@opensumi/ide-core-common';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IStorageServer, IUpdateRequest } from '../common';

enum StorageState {
  None,
  Initialized,
  Closed,
}

export class Storage implements IStorage {
  private static readonly DEFAULT_FLUSH_DELAY = 100;

  private _onDidChangeStorage = new Emitter<string>();
  readonly onDidChangeStorage: Event<string> = this._onDidChangeStorage.event;

  private flushDelayer: ThrottledDelayer<void>;

  private state = StorageState.None;

  private cache: Map<string, string> = new Map<string, string>();

  private pendingDeletes: Set<string> = new Set();
  private pendingInserts: Map<string, string> = new Map();

  private toDisposableCollection: DisposableCollection = new DisposableCollection();

  private storageName: string;

  private _whenReady: Promise<void>;

  constructor(
    private readonly database: IStorageServer,
    private readonly workspace: IWorkspaceService,
    private readonly appConfig: AppConfig,
    storageName: string,
    private readonly logger = getDebugLogger(),
  ) {
    this.storageName = storageName;
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
    return this._whenReady;
  }

  get items(): Map<string, string> {
    return this.cache;
  }

  get size(): number {
    return this.cache.size;
  }

  async init(storageName: string) {
    await this.workspace.whenReady;
    const workspace = this.workspace.workspace;
    await this.database.init(this.appConfig.storageDirName, workspace && workspace.uri);
    const cache = await this.database.getItems(storageName);
    this.cache = this.jsonToMap(cache);
    this.state = StorageState.Initialized;
  }

  setup(storageName: string) {
    this._whenReady = this.init(storageName);
  }

  async reConnectInit() {
    this.setup(this.storageName);
  }

  private jsonToMap(json) {
    const itemsMap: Map<string, string> = new Map();
    for (const key of Object.keys(json)) {
      itemsMap.set(key, json[key]);
    }
    return itemsMap;
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

  private flushPending(): Promise<void> {
    if (this.pendingInserts.size === 0 && this.pendingDeletes.size === 0) {
      return Promise.resolve();
    }

    // 获取等待的队列数据
    const updateRequest: IUpdateRequest = {
      insert: this.mapToJson(this.pendingInserts),
      delete: Array.from(this.pendingDeletes),
    };

    // 重置等待队列用于下次存储
    this.pendingDeletes = new Set<string>();
    this.pendingInserts = new Map<string, string>();

    // 更新数据
    return this.database.updateItems(this.storageName, updateRequest);
  }

  mapToJson(map: Map<string, string>) {
    const obj = Object.create(null);
    for (const [k, v] of map) {
      obj[k] = v;
    }
    return obj;
  }
}
