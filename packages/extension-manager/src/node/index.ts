import { Injectable, Provider } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';

import {
  IAlipayCloudMarketplaceService,
  IOpenvsxMarketplaceService,
  VSXExtensionBackSerivceToken,
  VSXExtensionServicePath,
} from '../common';

import { AlipayCloudMarketplaceService, OpenvsxMarketplaceService } from './marketplace';
import { VSXExtensionService } from './vsx-extension.service';

@Injectable()
export class OpenVsxExtensionManagerModule extends NodeModule {
  providers: Provider[] = [
    {
      token: VSXExtensionBackSerivceToken,
      useClass: VSXExtensionService,
    },
    {
      token: IAlipayCloudMarketplaceService,
      useClass: AlipayCloudMarketplaceService,
    },
    {
      token: IOpenvsxMarketplaceService,
      useClass: OpenvsxMarketplaceService,
    },
  ];

  backServices = [
    {
      servicePath: VSXExtensionServicePath,
      token: VSXExtensionBackSerivceToken,
    },
  ];
}
