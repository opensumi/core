import { Injectable } from '@ali/common-di';

@Injectable()
export class MockLoggerManagerClient {
  getLogger = () => {
    return {
      log() { },
      debug() { },
      error() { },
      verbose() { },
      warn() {},
      dispose() {},
    };
  }

  getLogFolder = () => '';
  onDidChangeLogLevel = () => {};
  getGlobalLogLevel = () => {};
}
