import { Injectable } from '@opensumi/common-di';

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
