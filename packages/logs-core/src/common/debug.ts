interface IDebugger {
    (formatter: any, ...args: any[]): void;

    color: string;
    enabled: boolean;
    log: (...args: any[]) => any;
    namespace: string;
    destroy: () => boolean;
    extend: (namespace: string, delimiter?: string) => IDebugger;
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
 *
 * const debugLog = new DebugLog({
 *  namespace: 'FileService',
 * });
 *
 * @export
 * @class DebugLog
 * @implements {IDebugLog}
 */
export class DebugLog implements IDebugLog {
  private namespace: string;
  private isEnable = false;

  constructor(namespace: string) {

    if (typeof process !== undefined &&
        process.env &&
        process.env.NODE_ENV === 'development') {
      this.isEnable = true;
    }

    this.namespace = namespace;
  }

  verbose(...args: any[]) {
    if (!this.isEnable) {
      return;
    }
    return console.log(`${this.namespace}:verbose `, ...args);
  }

  log(...args: any[]) {
    if (!this.isEnable) {
      return;
    }
    return console.log(`${this.namespace}:log `, ...args);
  }

  error(...args: any[]) {
    if (!this.isEnable) {
      return;
    }
    return console.error(`${this.namespace}:error `, ...args);
  }

  warn(...args: any[]) {
    if (!this.isEnable) {
      return;
    }
    return console.warn(`${this.namespace}:warn `, ...args);
  }

  info(...args: any[]) {
    if (!this.isEnable) {
      return;
    }
    return console.info(`${this.namespace}:info `, ...args);
  }

  debug(...args: any[]) {
    if (!this.isEnable) {
      return;
    }
    return console.debug(`${this.namespace}:debug `, ...args);
  }

  destroy() {}
}
