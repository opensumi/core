import { Provider, Injectable } from '@ide-framework/common-di';
import { NodeModule } from '@ide-framework/ide-core-node';

import { VSXExtensionBackSerivceToken, VSXExtensionServicePath } from '../common';
import { VSXExtensionService } from './vsx-extension.service';

@Injectable()
export class OpenVsxExtensionManagerModule extends NodeModule {
  providers: Provider[] = [
    {
      token: VSXExtensionBackSerivceToken,
      useClass: VSXExtensionService,
    },
  ];

  backServices = [
    {
      servicePath: VSXExtensionServicePath,
      token: VSXExtensionBackSerivceToken,
    },
  ];
}
