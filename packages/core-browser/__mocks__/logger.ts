import { Injectable, Autowired } from '@opensumi/di';
import {
  Archive,
  BaseLogServiceOptions,
  Emitter,
  ILogService,
  ILogServiceClient,
  ILogServiceManager,
  LogLevel,
  SupportLogNamespace,
} from '@opensumi/ide-core-common';

@Injectable()
export class MockLogger implements ILogServiceClient {
  async getLevel(): Promise<LogLevel> {
    return 0;
  }
  async setLevel(level: LogLevel): Promise<void> {
    // do nothing
  }
  async verbose(...args: any[]): Promise<void> {
    // console.log('[verbose]', args);
  }
  async debug(...args: any[]): Promise<void> {
    // console.log('[debug]', args);
  }
  async log(...args: any[]): Promise<void> {
    // console.log('[log]', args);
  }
  async warn(...args: any[]): Promise<void> {
    // console.log('[warn]', args);
  }
  async error(...args: any[]): Promise<void> {
    // console.log('[error]', args);
  }
  async critical(...args: any[]): Promise<void> {
    // console.log('[critical]', args);
  }
  async dispose(): Promise<void> {
    // do nothing
  }
}

@Injectable()
export class MockLoggerManageClient {
  @Autowired(MockLogger)
  private readonly logger: MockLogger;

  getLogger() {
    return this.logger;
  }
}

@Injectable()
export class MockLoggerService implements ILogServiceManager {
  @Autowired(MockLogger)
  private readonly logger: MockLogger;

  private onDidChangeLogLevelEmitter = new Emitter<LogLevel>();

  get onDidChangeLogLevel() {
    return this.onDidChangeLogLevelEmitter.event;
  }

  getLogger(namespace: SupportLogNamespace, loggerOptions?: BaseLogServiceOptions) {
    return this.logger as any;
  }

  getGlobalLogLevel() {
    return LogLevel.Info;
  }

  removeLogger(namespace: SupportLogNamespace) {}

  setGlobalLogLevel(level: LogLevel) {}

  getLogFolder() {
    return '';
  }

  getRootLogFolder() {
    return '';
  }

  async cleanOldLogs() {}

  async cleanAllLogs() {}

  async cleanExpiredLogs(day: number) {}

  getLogZipArchiveByDay(day: number): Promise<Archive> {
    throw Error('Not implement');
  }

  async getLogZipArchiveByFolder(foldPath: string): Promise<Archive> {
    throw Error('Not implement');
  }

  dispose() {
    this.onDidChangeLogLevelEmitter.dispose();
  }
}
