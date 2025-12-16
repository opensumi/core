import { Autowired, Injectable } from '@opensumi/di';
import { ClientAppContribution, Domain } from '@opensumi/ide-core-browser';
import { ILogger } from '@opensumi/ide-core-common';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';

@Injectable()
@Domain(ClientAppContribution)
export class WatcherDebugContribution implements ClientAppContribution {
  @Autowired(IFileServiceClient)
  private readonly fileServiceClient: IFileServiceClient;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  onDidStart(): void {
    this.fileServiceClient.onWatcherFailed?.((event) => {
      this.logger.error('[WatcherDebugContribution] Watcher failed', event);
    });

    this.fileServiceClient.onWatcherOverflow?.((event) => {
      this.logger.warn('[WatcherDebugContribution] Watcher overflow', event);
    });

    this.logger.log('[WatcherDebugContribution] Watcher debug contribution');
  }
}
