
import { IServerAppOpts, ServerApp, NodeModule } from '@ali/ide-core-node';
import { ILogService, ILogServiceOptions, LogLevel } from '@ali/ide-core-common';

export default class LogServiceClass {
  constructor(args: ILogServiceOptions) {
    console.log('LogServiceClass args', args);
  }

  debug(...args) {
    console.log('LogServiceClass debug', args);
  }

  error(...args) {
    console.log('LogServiceClass error', args);
  }

  log(...args) {
    console.log('LogServiceClass log', args);
  }
}
