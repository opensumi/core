// FIXME: 替换成自定义的后端实现

import { Injectable } from '@ali/common-di';
import { LogLevel, SupportLogNamespace } from '@ali/ide-core-browser';

@Injectable()
export class MockLogServiceForClient {
  private level: LogLevel;

  catchLogArgs: any[];
  namespace: SupportLogNamespace;

  async setLevel(namespace, level) {
    this.level = level;
    this.namespace = namespace;
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
