import { Injectable } from '@opensumi/di';
import { LogLevel, SupportLogNamespace } from '@opensumi/ide-core-browser';
import { ensureDir } from '@opensumi/ide-core-common/lib/browser-fs/ensure-dir';

@Injectable()
export class MockLogServiceForClient {
  private level: LogLevel;
  private dirInited = false;

  catchLogArgs: any[];
  namespace: SupportLogNamespace;

  async setLevel(namespace, level) {
    this.level = level;
    this.namespace = namespace;
  }

  async getLogFolder() {
    if (!this.dirInited) {
      await ensureDir('/log');
    }
    return '/log';
  }

  async getLevel() {
    return this.level;
  }

  async verbose(...args) {
    this.catchLogArgs = args;
  }

  async debug(...args) {
    this.catchLogArgs = args;
  }

  async log(...args) {
    this.catchLogArgs = args;
  }

  async warn(...args) {
    this.catchLogArgs = args;
  }

  async error(...args) {
    this.catchLogArgs = args;
  }

  async critical(...args) {
    this.catchLogArgs = args;
  }
}
