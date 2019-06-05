import { Injectable } from '@ali/common-di';
import { ILogger } from '@ali/ide-core-common';

@Injectable()
export class Logger implements ILogger {
  error(...args) {
    console.error(...args);
  }
  warn(...args) {
    console.log(...args);
  }
  log(...args) {
    console.log(...args);
  }
  debug(...args) {
    console.debug(...args);
  }
  info(...args) {
    console.info(...args);
  }
}
