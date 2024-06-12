import { Deferred } from '@opensumi/ide-core-common';

import { DebugLog, ILogServiceClient, ILogServiceForClient, LogLevel, SupportLogNamespace, format } from '../common/';

export class LogServiceClient implements ILogServiceClient {
  private namespace: SupportLogNamespace;
  private logServiceForClient: ILogServiceForClient;
  private debugLog: DebugLog;
  private pid: number | undefined;

  private level: LogLevel = LogLevel.Verbose;

  protected ready = new Deferred<void>();

  constructor(namespace: SupportLogNamespace, logServiceForClient: ILogServiceForClient, pid?: number) {
    this.namespace = namespace;
    this.logServiceForClient = logServiceForClient;
    this.debugLog = new DebugLog(namespace);
    this.pid = pid;

    this.init();
  }

  protected async init() {
    const level = await this.logServiceForClient.getGlobalLogLevel();
    this.level = level;
    this.ready.resolve();
  }

  async getLevel() {
    return await this.logServiceForClient.getLevel(this.namespace);
  }

  async setLevel(level: LogLevel) {
    this.level = level;
    await this.logServiceForClient.setLevel(this.namespace, level);
  }

  async verbose(...args: any[]) {
    this.debugLog.verbose(...args);

    await this.logServiceForClient.verbose(this.namespace, format(args), this.pid);
  }

  async debug(...args: any[]) {
    this.debugLog.debug(...args);

    await this.ready.promise;
    if (this.level > LogLevel.Debug) {
      return;
    }
    await this.logServiceForClient.debug(this.namespace, format(args), this.pid);
  }

  async log(...args: any[]) {
    this.debugLog.log(...args);

    await this.ready.promise;
    if (this.level > LogLevel.Info) {
      return;
    }
    await this.logServiceForClient.log(this.namespace, format(args), this.pid);
  }

  async warn(...args: any[]) {
    this.debugLog.warn(...args);

    await this.ready.promise;
    if (this.level > LogLevel.Warning) {
      return;
    }
    await this.logServiceForClient.warn(this.namespace, format(args), this.pid);
  }

  async error(...args: any[]) {
    this.debugLog.error(...args);

    await this.ready.promise;
    if (this.level > LogLevel.Error) {
      return;
    }
    await this.logServiceForClient.error(this.namespace, format(args), this.pid);
  }

  async critical(...args: any[]) {
    this.debugLog.error(...args);

    await this.ready.promise;
    if (this.level > LogLevel.Critical) {
      return;
    }
    await this.logServiceForClient.critical(this.namespace, format(args), this.pid);
  }

  async dispose() {
    await this.logServiceForClient.dispose(this.namespace);
  }
}
