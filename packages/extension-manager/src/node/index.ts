import { Provider, Injectable } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';

import {
  VSXExtensionBackSerivceToken,
  VSXExtensionServicePath,
  OpentrsMarketplaceToken,
  OpenvsxMarketplaceToken,
} from '../common';

import { OpentrsMarketplaceImpl, OpenvsxMarketplaceImpl } from './marketplace';
import { VSXExtensionService } from './vsx-extension.service';

@Injectable()
export class OpenVsxExtensionManagerModule extends NodeModule {
  providers: Provider[] = [
    {
      token: VSXExtensionBackSerivceToken,
      useClass: VSXExtensionService,
    },
    {
      token: OpentrsMarketplaceToken,
      useClass: OpentrsMarketplaceImpl,
    },
    {
      token: OpenvsxMarketplaceToken,
      useClass: OpenvsxMarketplaceImpl,
    },
  ];

  backServices = [
    {
      servicePath: VSXExtensionServicePath,
      token: VSXExtensionBackSerivceToken,
    },
  ];
}
