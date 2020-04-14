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
   * 是否可以重连
   */
  reconnected?: boolean;
  /**
   * 报错信息
   */
  message: string;
}

export const ITerminalErrorService = Symbol('ITerminalErrorService');
export interface ITerminalErrorService {
  errors: Map<string, ITerminalError>;
  fix(clientId: string): void;
}
