import { DebugLog, ILogServiceClient, LogLevel, SupportLogNamespace } from '../common';

export class LogServiceClientLocal implements ILogServiceClient {
  protected level: LogLevel;
  namespace: SupportLogNamespace;
  private debugLog: DebugLog;
  private pid: number | undefined;

  constructor(namespace: SupportLogNamespace, pid?: number) {
    this.namespace = namespace;
    this.debugLog = new DebugLog(namespace);
    this.pid = pid;
  }
  getLevel(): Promise<LogLevel> {
    return Promise.resolve(this.level);
  }
  async setLevel(level: LogLevel): Promise<void> {
    this.level = level;
  }
  async dispose(): Promise<void> {
    this.debugLog.destroy();
  }
  critical(...args: any[]): void {
    if (this.level <= LogLevel.Critical) {
      this.debugLog.error(...args);
    }
  }
  verbose(...args: any[]): void {
    if (this.level <= LogLevel.Verbose) {
      this.debugLog.verbose(...args);
    }
  }
  debug(...args: any[]): void {
    if (this.level <= LogLevel.Debug) {
      this.debugLog.debug(...args);
    }
  }
  log(...args: any[]): void {
    if (this.level <= LogLevel.Info) {
      this.debugLog.log(...args);
    }
  }
  warn(...args: any[]): void {
    if (this.level <= LogLevel.Warning) {
      this.debugLog.warn(...args);
    }
  }
  error(...args: any[]): void {
    if (this.level <= LogLevel.Error) {
      this.debugLog.error(...args);
    }
  }
}
