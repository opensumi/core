import { Injectable, Injector, Autowired } from '@ali/common-di';
import { LogLevel } from '@ali/ide-core-common';
import { IRPCProtocol } from '@ali/ide-connection';
import { IMainThreadExtensionLog, MainThreadExtensionLogIdentifier } from '../../../common/extension-log';
import { ILoggerManagerClient, SupportLogNamespace, ILogServiceClient } from '@ali/ide-logs/lib/browser';

@Injectable()
export class MainThreadExtensionLog implements IMainThreadExtensionLog {
  @Autowired(ILoggerManagerClient)
  private readonly loggerManager: ILoggerManagerClient;

  private get logger(): ILogServiceClient {
    return this.loggerManager.getLogger(SupportLogNamespace.ExtensionHost);
  }

  $getLevel() {
    return this.logger.getLevel();
  }

  $setLevel(level: LogLevel) {
    return this.logger.setLevel(level);
  }

  async $verbose(...args: any[]) {
    return this.logger.verbose(...args);
  }

  async $debug(...args: any[]) {
    return this.logger.debug(...args);
  }

  async $log(...args: any[]) {
    return this.logger.log(...args);
  }

  async $warn(...args: any[]) {
    return this.logger.warn(...args);
  }

  async $error(...args: any[]) {
    return this.logger.error(...args);
  }

  async $critical(...args: any[]) {
    return this.logger.critical(...args);
  }

  $dispose() {
    return this.logger.dispose();
  }
}

/**
 * @deprecated
 */
export function createExtensionLogFactory(
  rpcProtocol: IRPCProtocol,
  injector: Injector,
) {
  rpcProtocol.set<IMainThreadExtensionLog>(MainThreadExtensionLogIdentifier, injector.get(MainThreadExtensionLog));
}
