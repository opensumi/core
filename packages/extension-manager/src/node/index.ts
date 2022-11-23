import { Provider, Injectable } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';

import {
  VSXExtensionBackSerivceToken,
  VSXExtensionServicePath,
  IOpenvsxMarketplaceService,
  IOpentrsMarketplaceService,
} from '../common';

import { OpentrsMarketplaceService, OpenvsxMarketplaceService } from './marketplace';
import { VSXExtensionService } from './vsx-extension.service';

@Injectable()
export class OpenVsxExtensionManagerModule extends NodeModule {
  providers: Provider[] = [
    {
      token: VSXExtensionBackSerivceToken,
      useClass: VSXExtensionService,
    },
    {
      token: IOpentrsMarketplaceService,
      useClass: OpentrsMarketplaceService,
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
