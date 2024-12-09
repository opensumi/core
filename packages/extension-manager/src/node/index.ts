import { Injectable, Provider } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';

import { IOpenvsxMarketplaceService } from '../common';

import { OpenvsxMarketplaceService } from './marketplace';
import { VSXExtensionRemoteService } from './vsx-extension.service';

@Injectable()
export class OpenVsxExtensionManagerModule extends NodeModule {
  providers: Provider[] = [
    {
      token: IOpenvsxMarketplaceService,
      useClass: OpenvsxMarketplaceService,
    },
  ];

  remoteServices = [VSXExtensionRemoteService];
}
