import { Injectable } from '@ali/common-di';
import { ILogServiceClient, LogLevel } from '@ali/ide-core-common';

@Injectable()
export class MockLoggerManageClient {
  mockClient = new MockLoggerClient();

  getLogger() {
    return this.mockClient;
  }
}

// tslint:disable no-console
class MockLoggerClient implements ILogServiceClient {
  async getLevel(): Promise<LogLevel> {
    return 0;
  }
  async setLevel(level: LogLevel): Promise<void> {

  }
  async verbose(...args: any[]): Promise<void> {
    console.log('[verbose]', args);
  }
  async debug(...args: any[]): Promise<void> {
    console.log('[debug]', args);
  }
  async log(...args: any[]): Promise<void> {
    console.log('[log]', args);
  }
  async warn(...args: any[]): Promise<void> {
    console.log('[warn]', args);
  }
  async error(...args: any[]): Promise<void> {
    console.log('[error]', args);
  }
  async critical(...args: any[]): Promise<void> {
    console.log('[critical]', args);
  }
  async dispose(): Promise<void> {

  }

}
