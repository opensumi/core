import { MainThreadExtensionLogIdentifier, IMainThreadExtensionLog } from '../common/extension-log';
import { RPCProtocol } from '@ali/ide-connection';
import { DebugLog, SupportLogNamespace } from '@ali/ide-core-common';

export class ExtensionLogger {
  private rpcProtocol: RPCProtocol;
  private logger: IMainThreadExtensionLog;
  private debugLog: DebugLog;

  constructor(rpcProtocol: RPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this.logger = this.rpcProtocol.getProxy(MainThreadExtensionLogIdentifier);
    this.debugLog = new DebugLog(SupportLogNamespace.ExtensionHost);
  }

  verbose(...args: any[]) {
    this.whenReady.then(() => {
      this.debugLog.info(...args);
      this.logger.$verbose(...args);
    });
  }

  debug(...args: any[]) {
    this.whenReady.then(() => {
      this.debugLog.debug(...args);
      this.logger.$debug(...args);
    });
  }

  log(...args: any[]) {
    this.whenReady.then(() => {
      this.debugLog.log(...args);
      this.logger.$log(...args);
    });
  }

  warn(...args: any[]) {
    this.whenReady.then(() => {
      this.debugLog.warn(...args);
      this.logger.$warn(...args);
    });
  }

  error(...args: any[]) {
    this.whenReady.then(() => {
      this.debugLog.error(...args);
      this.logger.$error(...args);
    });
  }

  critical(...args: any[]) {
    this.whenReady.then(() => {
      this.debugLog.error(...args);
      this.logger.$critical(...args);
    });
  }

  private get whenReady() {
    return this.rpcProtocol.whenReadySend || Promise.resolve();
  }
}
