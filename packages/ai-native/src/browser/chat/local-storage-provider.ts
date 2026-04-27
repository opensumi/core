import { Autowired, Injectable } from '@opensumi/di';
import { Domain, IStorage, STORAGE_NAMESPACE, StorageProvider } from '@opensumi/ide-core-common';

import { ISessionModel, ISessionProvider, SessionProviderDomain } from './session-provider';

/**
 * LocalStorage Session Provider
 * 负责从浏览器 LocalStorage 加载和保存 Session
 */
@Domain(SessionProviderDomain)
@Injectable()
export class LocalStorageProvider implements ISessionProvider {
  readonly id = 'local-storage';

  @Autowired(StorageProvider)
  private storageProvider: StorageProvider;

  private _chatStorage: IStorage | null = null;

  /**
   * 获取 storage 实例（延迟初始化）
   */
  private async getStorage(): Promise<IStorage> {
    if (!this._chatStorage) {
      this._chatStorage = await this.storageProvider(STORAGE_NAMESPACE.CHAT);
    }
    return this._chatStorage;
  }

  /**
   * 判断是否支持处理该来源
   * 支持：'local' 前缀或无前缀（兼容旧数据）
   */
  canHandle(mode: string): boolean {
    return mode === 'local';
  }

  /**
   * 加载所有本地 Session
   */
  async loadSessions(): Promise<ISessionModel[]> {
    const storage = await this.getStorage();
    const sessionsModelData = storage.get<ISessionModel[]>('sessionModels', []);
    // 过滤掉空消息历史的会话
    return sessionsModelData.filter((item) => item.history?.messages?.length > 0);
  }

  /**
   * 加载指定 Session
   */
  async loadSession(sessionId: string): Promise<ISessionModel | undefined> {
    const storage = await this.getStorage();
    const sessionsModelData = storage.get<ISessionModel[]>('sessionModels', []);
    return sessionsModelData.find((item) => item.sessionId === sessionId);
  }

  /**
   * 保存 Session 到 localStorage
   */
  async saveSessions(sessions: ISessionModel[]): Promise<void> {
    const storage = await this.getStorage();
    storage.set('sessionModels', sessions);
  }
}
