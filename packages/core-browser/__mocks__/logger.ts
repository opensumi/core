import { Injectable, Autowired } from '@ali/common-di';
import { ILogServiceClient, LogLevel } from '@ali/ide-core-common';

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
