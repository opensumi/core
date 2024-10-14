import { Injector } from '@opensumi/di';
import { IExtensionLogger, ILogService, LogLevel, SupportLogNamespace } from '@opensumi/ide-core-common';
import { LogServiceManager } from '@opensumi/ide-logs/lib/node/log-manager';

import { ExtHostAppConfig } from '../common/ext.process';
import { getNodeRequire } from '../common/utils';

export class ExtensionLogger2 implements IExtensionLogger {
  private injector: Injector;
  private loggerManager: LogServiceManager;
  private logger: ILogService;
  private config: ExtHostAppConfig;

  constructor(injector: Injector) {
    this.injector = injector;
    this.config = this.injector.get(ExtHostAppConfig);
    this.injectLogService();
    // 这块不是非常合理，插件进程引用了 Node 主进程的代码，先改为多例方式防止 AppConfig 找不到的问题
    this.loggerManager = this.injector.get(LogServiceManager, [this.config]);
    this.logger = this.loggerManager.getLogger(SupportLogNamespace.ExtensionHost, this.config);
  }

  injectLogService() {
    if (this.config.LogServiceClass) {
      const LogServiceClass = this.config.LogServiceClass;

      this.injector.overrideProviders({
        token: ExtHostAppConfig,
        useValue: Object.assign({}, this.config, { LogServiceClass }),
      });
    } else if (this.config.extLogServiceClassPath) {
      let LogServiceClass = getNodeRequire()(this.config.extLogServiceClassPath);

      if (LogServiceClass.default) {
        LogServiceClass = LogServiceClass.default;
      }
      this.injector.overrideProviders({
        token: ExtHostAppConfig,
        useValue: Object.assign({}, this.config, { LogServiceClass }),
      });
    }
  }

  error(...args) {
    return this.logger.error(...args);
  }

  warn(...args) {
    return this.logger.warn(...args);
  }

  log(...args) {
    return this.logger.log(...args);
  }
  debug(...args) {
    return this.logger.debug(...args);
  }

  verbose(...args) {
    return this.logger.verbose(...args);
  }

  critical(...args) {
    return this.logger.critical(...args);
  }

  dispose() {
    return this.logger.dispose();
  }

  setOptions(options) {
    return this.logger.setOptions(options);
  }

  sendLog(level: LogLevel, message: string) {
    return this.logger.sendLog(level, message);
  }

  drop() {
    return this.logger.drop();
  }

  flush() {
    return this.logger.flush();
  }

  getLevel() {
    return this.logger.getLevel();
  }

  setLevel(level: LogLevel) {
    return this.logger.setLevel(level);
  }
}
