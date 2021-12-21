import { IMainThreadExtensionLog } from '@opensumi/ide-extension/lib/common/extension-log';
import { LogLevel } from '@opensumi/ide-core-common';

export class MainThreadExtensionLog implements IMainThreadExtensionLog {
  private level: LogLevel = LogLevel.Verbose;
  $getLevel() {
    return this.level;
  }

  $setLevel(level: LogLevel) {
    this.level = level;
  }

  $verbose() {
    return Promise.resolve();
  }

  $debug() {
    return Promise.resolve();
  }

  $log() {
    return Promise.resolve();
  }

  $warn() {
    return Promise.resolve();
  }

  $error() {
    return Promise.resolve();
  }

  $critical() {
    return Promise.resolve();
  }

  $dispose() {
    return Promise.resolve();
  }
}
