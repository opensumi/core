import { Injectable } from '@opensumi/di';

@Injectable()
export class MockLoggerManagerClient {
  getLogger = () => ({
    log() {},
    debug() {},
    error() {},
    verbose() {},
    warn() {},
    dispose() {},
  });

  getLogFolder = () => '';
  onDidChangeLogLevel = () => {};
  getGlobalLogLevel = () => {};
}
