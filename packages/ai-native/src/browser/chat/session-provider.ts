import { IHistoryChatMessage } from '@opensumi/ide-core-common/lib/types/ai-native';

import { IChatFollowup, IChatRequestMessage, IChatResponseErrorDetails } from '../../common';

import { IChatProgressResponseContent } from './chat-model';

/**
 * Session 模型数据结构（用于持久化）
 */
export interface ISessionModel {
  sessionId: string;
  modelId?: string;
  history: { additional: Record<string, any>; messages: IHistoryChatMessage[] };
  requests: {
    requestId: string;
    message: IChatRequestMessage;
    response: {
      isCanceled: boolean;
      responseText: string;
      responseContents: IChatProgressResponseContent[];
      responseParts: IChatProgressResponseContent[];
      errorDetails: IChatResponseErrorDetails | undefined;
      followups: IChatFollowup[] | undefined;
    };
  }[];
  lastLoadedAt?: number;
  title?: string;
}

/**
 * Session Provider 接口
 * 抽象不同数据源的 Session 加载逻辑
 */
export interface ISessionProvider {
  /** Provider 唯一标识 */
  readonly id: string;

  /**
   * 判断是否支持处理该来源的 Session
   * @param source Session 来源标识（如 'local', 'acp', 'acp:sess_123'）
   */
  canHandle(source: string): boolean;

  /**
   * 创建新会话
   * @param title 可选的会话标题
   * @returns 创建的 Session 数据
   */
  createSession?(): Promise<ISessionModel>;

  /**
   * 加载所有可用会话
   * @returns Session 数据列表
   */
  loadSessions(): Promise<ISessionModel[]>;

  /**
   * 加载指定会话
   * @param sessionId 本地 Session ID
   * @returns Session 数据，不存在时返回 undefined
   */
  loadSession(sessionId: string): Promise<ISessionModel | undefined>;

  /**
   * 保存会话（可选实现）
   * @param sessions Session 数据列表
   */
  saveSessions?(sessions: ISessionModel[]): Promise<void>;
}

/**
 * Session Provider Token（用于 DI）
 */
export const ISessionProvider = Symbol('ISessionProvider');

/**
 * Session Provider Domain（用于 DI 多实例注入）
 */
export const SessionProviderDomain = Symbol('SessionProviderDomain');

/**
 * Session 加载状态枚举
 */
export enum SessionLoadState {
  /** 正在从远程加载 */
  LOADING = 'loading',
  /** 完整数据已加载 */
  LOADED = 'loaded',
  /** 加载失败 */
  ERROR = 'error',
}

/**
 * Session 来源类型
 */
export type SessionSource = 'local' | 'acp';

/**
 * 解析 Session ID，提取来源和原始 ID
 * @param sessionId 本地 Session ID（如 'local:uuid', 'acp:sess_123'）
 * @returns 来源标识和原始 ID
 */
export function parseSessionId(sessionId: string): { source: SessionSource; originalId: string } {
  if (sessionId.startsWith('acp:')) {
    return { source: 'acp', originalId: sessionId.slice(4) };
  }
  // 默认视为 local 来源（兼容旧数据）
  return { source: 'local', originalId: sessionId };
}
