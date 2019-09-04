export type DebugViewLocation = 'default' | 'left' | 'right' | 'bottom';
/**
 * 调试适配器进程配置.
 */
export interface DebugConfiguration {
  /**
   * 调试适配器进程类型.
   */
  type: string;

  /**
   * 调试适配器进程名称
   */
  name: string;

  /**
   * 拓展属性
   */
  [key: string]: any;

  /**
   * 调试适配器进程请求类型
   */
  request: string;

  /**
   * 如果noDebug为true，则启动请求应启动程序而不启用调试
   */
  noDebug?: boolean;

  /**
   * 来自先前的重启进程的可选参数
   * 该数据作为'terminated'事件的'restart'属性传递
   * 客户端需保证数据完整性
   */
  __restart?: any;

  /**
   * 默认的调试工具栏视图位置
   * 默认值：default
   */
  debugViewLocation?: DebugViewLocation;

  /**
   * 打开调试视图时机
   * 默认值：neverOpen
   */
  openDebug?: 'neverOpen' | 'openOnSessionStart' | 'openOnFirstSessionStart' | 'openOnDebugBreak';

  /**
   * 打开内置DebugConsole视图时机
   * 默认值：neverOpen
   */
  internalConsoleOptions?: 'neverOpen' | 'openOnSessionStart' | 'openOnFirstSessionStart';
}

export namespace DebugConfiguration {
  export function is(arg: DebugConfiguration | any): arg is DebugConfiguration {
      return !!arg && typeof arg === 'object' && 'type' in arg && 'name' in arg && 'request' in arg;
  }
}
