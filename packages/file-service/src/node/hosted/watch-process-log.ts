import { IWatcherProcessLogger } from '@opensumi/ide-core-common/lib/log';


export class WatcherProcessLogger implements IWatcherProcessLogger {
  constructor(
    private logDir: string,
    private logLevel: string,
  ) {

  }

  verbose(...args: any[]): void {
    throw new Error('Method not implemented.');
  }
  debug(...args: any[]): void {
    throw new Error('Method not implemented.');
  }
  log(...args: any[]): void {
    throw new Error('Method not implemented.');
  }
  warn(...args: any[]): void {
    throw new Error('Method not implemented.');
  }
  error(...args: any[]): void {
    throw new Error('Method not implemented.');
  }

}
