import { Provider, Injectable } from '@ide-framework/common-di';
import { BrowserModule } from '@ide-framework/ide-core-browser';

import { VSXExtensionBackSerivceToken, VSXExtensionServicePath, VSXExtensionServiceToken } from '../common';
import { VSXExtensionContribution } from './vsx-extension.contribution';
import { VSXExtensionService } from './vsx-extension.service';

@Injectable()
export class OpenVsxExtensionManagerModule extends BrowserModule {
  providers: Provider[] = [
    VSXExtensionContribution,
    {
      token: VSXExtensionServiceToken,
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
