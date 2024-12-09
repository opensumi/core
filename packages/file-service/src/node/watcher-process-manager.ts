import { Autowired, Injectable } from '@opensumi/di';
import { ILogServiceManager, SupportLogNamespace } from '@opensumi/ide-core-common/lib/log';
import { AppConfig, ILogService } from '@opensumi/ide-core-node';

export const WatcherProcessManagerToken = Symbol('WatcherProcessManager');

@Injectable()
export class WatcherProcessManager {
  static MaxWatcherProcessCount = 5;

  private clientExtProcessMap: Map<string, number> = new Map();

  private logger: ILogService;

  @Autowired(ILogServiceManager)
  private readonly loggerManager: ILogServiceManager;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  constructor() {
    this.logger = this.loggerManager.getLogger(SupportLogNamespace.Node);
  }

  async createProcess(clientId: string) {
    this.logger.log('create watcher prcess for client: ', clientId);
    this.logger.log('appconfig watcherHost: ', this.appConfig.watcherHost);

    if (this.clientExtProcessMap.size >= WatcherProcessManager.MaxWatcherProcessCount) {
      const processClientIdArr = Array.from(this.clientExtProcessMap.keys());

      const killProcessClientId = processClientIdArr[0];
      this.logger.error(
        `Process count is over limit, max count is ${WatcherProcessManager.MaxWatcherProcessCount}, try kill`,
        killProcessClientId,
      );
    }
  }

  async disposeAllProcess() {}
}
