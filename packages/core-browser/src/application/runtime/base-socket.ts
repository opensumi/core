import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { WSChannel } from '@opensumi/ide-connection';
import { WSChannelHandler } from '@opensumi/ide-connection/lib/browser';
import { IRuntimeSocketConnection } from '@opensumi/ide-connection/lib/common/connection';
import { IReporterService, getDebugLogger } from '@opensumi/ide-core-common';

import { ModuleConstructor, createConnectionService } from '../../bootstrap';
import { AppConfig } from '../../react-providers';

const initialLogger = getDebugLogger();

@Injectable({ multiple: true })
export abstract class BaseConnectionHelper {
  @Autowired(INJECTOR_TOKEN)
  protected injector: Injector;

  @Autowired(AppConfig)
  protected appConfig: AppConfig;

  @Autowired(IReporterService)
  reporterService: IReporterService;

  abstract getDefaultClientId(): string;

  abstract createConnection(): IRuntimeSocketConnection;

  async createRPCServiceChannel(modules: ModuleConstructor[]): Promise<WSChannel> {
    const connection: IRuntimeSocketConnection<Uint8Array> = this.createConnection();
    const clientId: string = this.appConfig.clientId ?? this.getDefaultClientId();
    const channelHandler = new WSChannelHandler(connection, clientId, {
      logger: initialLogger,
    });

    return createConnectionService(this.injector, modules, channelHandler);
  }
}
