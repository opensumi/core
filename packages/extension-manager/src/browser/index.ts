import { Injectable, Provider } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { VSXExtensionServicePath, VSXExtensionServiceToken } from '../common';

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
    },
  ];
}
