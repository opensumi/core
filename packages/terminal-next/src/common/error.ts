export interface ITerminalError {
  /**
   * 终端客户端的唯一标别
   */
  id: string;
  /**
   * 是否已经中断
   */
  stopped: boolean;
  /**
   * 是否需要继续重连，默认为 true
   */
  shouldReconnect?: boolean;
  /**
   * 报错信息
   */
  message: string;
  /**
   * @deprecated 是否可以重连
   *
   * 这个字段语义不太正确，而且框架层并没有用到，后面尽量不要使用
   */
  reconnected?: boolean;
}

export function isTerminalError(data: any): data is ITerminalError {
  return data.message !== undefined;
}

export const ITerminalErrorService = Symbol('ITerminalErrorService');
export interface ITerminalErrorService {
  errors: Map<string, ITerminalError>;
  fix(clientId: string): Promise<void>;
}
