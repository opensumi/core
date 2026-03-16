import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { Disposable, IDisposable } from '@opensumi/ide-core-common';

import { ISessionProvider, SessionProviderDomain } from './session-provider';

/**
 * Session Provider Registry Token（用于 DI）
 */
export const ISessionProviderRegistry = Symbol('ISessionProviderRegistry');

/**
 * Session Provider Registry 接口
 * 管理所有注册的 Session Provider，提供 Provider 路由功能
 */
export interface ISessionProviderRegistry {
  /**
   * 注册 Provider
   * @param provider Session Provider 实例
   * @returns 注销句柄
   */
  registerProvider(provider: ISessionProvider): IDisposable;

  /**
   * 根据 source 前缀获取 Provider
   * @param source 来源标识（如 'local', 'acp'）
   * @returns 对应的 Provider，未找到返回 undefined
   */
  getProvider(source: string): ISessionProvider | undefined;

  /**
   * 根据 Session ID 获取 Provider
   * 解析 Session ID 的 source 前缀，路由到对应 Provider
   * @param sessionId 本地 Session ID（如 'local:uuid', 'acp:sess_123'）
   * @returns 对应的 Provider，未找到返回 undefined
   */
  getProviderBySessionId(sessionId: string): ISessionProvider | undefined;

  /**
   * 获取所有已注册的 Provider
   * @returns Provider 列表
   */
  getAllProviders(): ISessionProvider[];
}

/**
 * Session Provider Registry 实现
 * 轻量级路由，不负责加载逻辑，只负责 Provider 注册和查找
 */
@Injectable()
export class SessionProviderRegistry extends Disposable implements ISessionProviderRegistry {
  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  private providers: Map<string, ISessionProvider> = new Map();
  private initialized = false;

  constructor() {
    super();
    this.initialize();
  }

  /**
   * 初始化：从 DI 收集所有标注了 @Domain(SessionProviderDomain) 的 Provider
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    // 从 DI 获取所有 SessionProviderDomain 的实例
    const domainProviders = this.injector.getFromDomain(SessionProviderDomain) as ISessionProvider[];

    for (const provider of domainProviders) {
      this.registerProvider(provider);
    }

    this.initialized = true;
  }

  /**
   * 注册 Provider
   */
  registerProvider(provider: ISessionProvider): IDisposable {
    if (this.providers.has(provider.id)) {
      // Provider 已存在，将被覆盖
    }

    this.providers.set(provider.id, provider);

    return {
      dispose: () => {
        this.providers.delete(provider.id);
      },
    };
  }

  /**
   * 根据 source 前缀获取 Provider
   */
  getProvider(source: string): ISessionProvider | undefined {
    // 先尝试直接匹配 source
    const providers = Array.from(this.providers.values());
    for (const provider of providers) {
      try {
        const canHandleResult = provider.canHandle(source);
        if (canHandleResult) {
          return provider;
        }
      } catch (error) {
        // Provider canHandle() threw error
      }
    }
    return undefined;
  }

  /**
   * 根据 Session ID 获取 Provider
   */
  getProviderBySessionId(sessionId: string): ISessionProvider | undefined {
    const provider = this.getProvider(sessionId);
    return provider;
  }

  /**
   * 获取所有已注册的 Provider
   */
  getAllProviders(): ISessionProvider[] {
    return Array.from(this.providers.values());
  }
}
