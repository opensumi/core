import { IExtensionLogger } from '@opensumi/ide-core-common';

export class ExtensionLogger implements IExtensionLogger {
  verbose(...args: any[]): void {
    console.debug(...args);
  }
  debug(...args: any[]): void {
    console.debug(...args);
  }
  log(...args: any[]): void {
    console.log(...args);
  }
  warn(...args: any[]): void {
    console.warn(...args);
  }
  error(...args: any[]): void {
    console.error(...args);
  }
}
