interface IDebugger {
    (formatter: any, ...args: any[]): void;

    color: string;
    enabled: boolean;
    log: (...args: any[]) => any;
    namespace: string;
    destroy: () => boolean;
    extend: (namespace: string, delimiter?: string) => IDebugger;
}

export interface DebugLogOptions {
  namespace: string;
}

export interface IDebugLog {
  log(...args: any[]): void;
  error(...args: any[]): void;
  warn(...args: any[]): void;
  debug(...args: any[]): void;
  info(...args: any[]): void;

  destroy(): void;
}

/**
 * 支持浏览器端和Node.js端，实际调用 https://www.npmjs.com/package/debug
 * 浏览器端：设置 localStorage.debug=`${namespace}:*` 显示对应的log
 * Node.js端：在终端设置 export DEBUG=`${namespace}:*` 线上对应log
 *
 * 比如：
 * const debugLog = new DebugLog({
 *  namespace: 'FileService',
 * });
 *
 * 开启显示：
 * localStorage.setItem('debug', 'FileService:*')
 * export DEBUG=FileService:*
 *
 * @export
 * @class DebugLog
 * @implements {IDebugLog}
 */
export class DebugLog implements IDebugLog {
  private namespace: string;

  private debuggerLog: IDebugger;
  private debuggerError: IDebugger;
  private debuggerWarn: IDebugger;
  private debuggerDebug: IDebugger;
  private debuggerInfo: IDebugger;

  constructor(options: DebugLogOptions) {
    let debug: any;
    try {
      if (process.env.NODE_ENV !== 'development') {
        throw new Error('Not development!');
      }
      debug = require('debug');
    } catch (e) {
      debug = () => () => {};
    }
    const { namespace } = options;

    this.namespace = namespace;
    this.debuggerLog = debug(`${namespace}:log`);
    this.debuggerError = debug(`${namespace}:error`);
    this.debuggerWarn = debug(`${namespace}:warn`);
    this.debuggerDebug = debug(`${namespace}:debug`);
    this.debuggerInfo = debug(`${namespace}:info`);
  }

  log(...args: any[]) {
    return this.debuggerLog('', ...args);
  }

  error(...args: any[]) {
    return this.debuggerError('', ...args);
  }

  warn(...args: any[]) {
    return this.debuggerWarn('', ...args);
  }

  info(...args: any[]) {
    return this.debuggerInfo('', ...args);
  }

  debug(...args: any[]) {
    return this.debuggerDebug('', ...args);
  }

  destroy() {
    this.debuggerLog.destroy();
    this.debuggerError.destroy();
    this.debuggerDebug.destroy();
    this.debuggerInfo.destroy();
    this.debuggerWarn.destroy();
  }
}
