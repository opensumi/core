import { Injectable, Provider } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';

import { IAlipayCloudMarketplaceService, IOpenvsxMarketplaceService } from '../common';

import { AlipayCloudMarketplaceService, OpenvsxMarketplaceService } from './marketplace';
import { VSXExtensionService } from './vsx-extension.service';

@Injectable()
export class OpenVsxExtensionManagerModule extends NodeModule {
  providers: Provider[] = [
    {
      token: IAlipayCloudMarketplaceService,
      useClass: AlipayCloudMarketplaceService,
    },
    {
      token: IOpenvsxMarketplaceService,
      useClass: OpenvsxMarketplaceService,
    },
  ];

  remoteServices = [VSXExtensionService];
}
