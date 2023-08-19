import { Injector } from '@opensumi/di';
import { RPCProtocol } from '@opensumi/ide-connection';
import {
  getNodeRequire,
  SupportLogNamespace,
  ILogService,
  IExtensionLogger,
  DebugLog,
} from '@opensumi/ide-core-common';
import { AppConfig } from '@opensumi/ide-core-node/lib/types';
import { LogServiceManager } from '@opensumi/ide-logs/lib/node/log-manager';

import { IMainThreadExtensionLog, MainThreadExtensionLogIdentifier } from '../common/extension-log';

export abstract class AbstractExtensionLogger implements IExtensionLogger {
  logger: IMainThreadExtensionLog | ILogService;
  methodNames: Record<string, string>;
  private debugLog: DebugLog;

  constructor() {
    this.methodNames = {
      verbose: 'verbose',
      debug: 'debug',
      log: 'log',
      warn: 'warn',
      error: 'error',
      critical: 'critical',
    };
    this.debugLog = new DebugLog(SupportLogNamespace.ExtensionHost);
  }

  verbose(...args: any[]) {
    this.debugLog.info(...args);
    return this.logger[this.methodNames.verbose](...args);
  }

  debug(...args: any[]) {
    this.debugLog.debug(...args);
    return this.logger[this.methodNames.debug](...args);
  }

  log(...args: any[]) {
    this.debugLog.log(...args);
    return this.logger[this.methodNames.log](...args);
  }

  warn(...args: any[]) {
    this.debugLog.warn(...args);
    return this.logger[this.methodNames.warn](...args);
  }

  error(...args: any[]) {
    this.debugLog.error(...args);
    return this.logger[this.methodNames.error](...args);
  }

  critical(...args: any[]) {
    this.debugLog.error(...args);
    return this.logger[this.methodNames.critical](...args);
  }
}

export class ExtensionWorkerLogger extends AbstractExtensionLogger {
  private rpcProtocol: RPCProtocol;

  constructor(rpcProtocol: RPCProtocol) {
    super();
    this.rpcProtocol = rpcProtocol;
    this.methodNames = {
      verbose: '$verbose',
      debug: '$debug',
      log: '$log',
      warn: '$warn',
      error: '$error',
      critical: '$critical',
    };
    this.logger = this.rpcProtocol.getProxy(MainThreadExtensionLogIdentifier);
  }
}

export class ExtensionLogger extends AbstractExtensionLogger {
  private injector: Injector;
  private loggerManager: LogServiceManager;
  private config: any;
  logger: ILogService;

  constructor(injector) {
    super();
    this.injector = injector;
    this.config = this.injector.get(AppConfig);
    this.injectLogService();

    this.loggerManager = this.injector.get(LogServiceManager);
    this.logger = this.loggerManager.getLogger(SupportLogNamespace.ExtensionHost, this.config);
  }
  injectLogService() {
    if (this.config.LogServiceClass) {
      const LogServiceClass = this.config.LogServiceClass;

      this.injector.overrideProviders({
        token: AppConfig,
        useValue: Object.assign({}, this.config, { LogServiceClass }),
      });
    } else if (this.config.extLogServiceClassPath) {
      let LogServiceClass = getNodeRequire()(this.config.extLogServiceClassPath);

      if (LogServiceClass.default) {
        LogServiceClass = LogServiceClass.default;
      }
      this.injector.overrideProviders({
        token: AppConfig,
        useValue: Object.assign({}, this.config, { LogServiceClass }),
      });
    }
  }
}
