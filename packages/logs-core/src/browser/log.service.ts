import { DebugLog, ILogServiceClient, ILogServiceForClient, LogLevel, SupportLogNamespace, format } from '../common/';

export class LogServiceClient implements ILogServiceClient {
  private namespace: SupportLogNamespace;
  private logServiceForClient: ILogServiceForClient;
  private debugLog: DebugLog;
  private pid: number | undefined;

  constructor(namespace: SupportLogNamespace, logServiceForClient, pid?: number) {
    this.namespace = namespace;
    this.logServiceForClient = logServiceForClient;
    this.debugLog = new DebugLog(namespace);
    this.pid = pid;
  }

  async getLevel() {
    return await this.logServiceForClient.getLevel(this.namespace);
  }

  async setLevel(level: LogLevel) {
    await this.logServiceForClient.setLevel(this.namespace, level);
  }

  async verbose(...args: any[]) {
    this.debugLog.verbose(...args);
    await this.logServiceForClient.verbose(this.namespace, format(args), this.pid);
  }

  async debug(...args: any[]) {
    this.debugLog.debug(...args);
    await this.logServiceForClient.debug(this.namespace, format(args), this.pid);
  }

  async log(...args: any[]) {
    this.debugLog.log(...args);
    await this.logServiceForClient.log(this.namespace, format(args), this.pid);
  }

  async warn(...args: any[]) {
    this.debugLog.warn(...args);
    await this.logServiceForClient.warn(this.namespace, format(args), this.pid);
  }

  async error(...args: any[]) {
    this.debugLog.error(...args);
    await this.logServiceForClient.error(this.namespace, format(args), this.pid);
  }

  async critical(...args: any[]) {
    this.debugLog.error(...args);
    await this.logServiceForClient.critical(this.namespace, format(args), this.pid);
  }

  async dispose() {
    await this.logServiceForClient.dispose(this.namespace);
  }
}
