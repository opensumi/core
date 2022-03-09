import { RPCProtocol } from '@opensumi/ide-connection';
import { DebugLog, IExtensionLogger, SupportLogNamespace } from '@opensumi/ide-core-common';

import { MainThreadExtensionLogIdentifier, IMainThreadExtensionLog } from '../common/extension-log';

export class ExtensionLogger implements IExtensionLogger {
  private rpcProtocol: RPCProtocol;
  private logger: IMainThreadExtensionLog;
  private debugLog: DebugLog;

  constructor(rpcProtocol: RPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this.logger = this.rpcProtocol.getProxy(MainThreadExtensionLogIdentifier);
    this.debugLog = new DebugLog(SupportLogNamespace.ExtensionHost);
  }

  verbose(...args: any[]) {
    this.debugLog.info(...args);
    return this.logger.$verbose(...args);
  }

  debug(...args: any[]) {
    this.debugLog.debug(...args);
    return this.logger.$debug(...args);
  }

  log(...args: any[]) {
    this.debugLog.log(...args);
    return this.logger.$log(...args);
  }

  warn(...args: any[]) {
    this.debugLog.warn(...args);
    return this.logger.$warn(...args);
  }

  error(...args: any[]) {
    this.debugLog.error(...args);
    return this.logger.$error(...args);
  }

  critical(...args: any[]) {
    this.debugLog.error(...args);
    return this.logger.$critical(...args);
  }
}
