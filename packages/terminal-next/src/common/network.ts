export const ITerminalNetwork = Symbol('ITerminalNetwork');

export enum TerminalNetworkStatus {
  DISCONNECTED = 0,
  CONNECTED = 1,
}

export interface ITerminalNetwork {
  bindErrors(): void;

  /**
   * 当前网络状态
   */
  status: TerminalNetworkStatus;

  /**
   * 更新网络状态
   */
  setStatus(status: TerminalNetworkStatus): void;

  /**
   * 触发一次重连
   */
  reconnect(): void;

  /**
   * 重连 sessionId 指定的 client
   */
  reconnectClient(sessionId: string): Promise<void>;

  /**
   * 安排重连任务，具体的触发时机由底层决定。
   * 此方法可以多次调用，不会频繁触发重连。
   */
  scheduleReconnection(): void;

  /**
   * 是否准备重试
   */
  shouldReconnect(sessionId: string): boolean;

  /**
   * 获取当前的重试信息
   */
  getReconnectInfo(sessionId: string): ITerminalReconnectInfo;
}

export interface ITerminalReconnectInfo {
  /**
   * 重试次数
   */
  times: number;
  /**
   * 下一次重试的时间
   */
  nextRetry: number;
}
