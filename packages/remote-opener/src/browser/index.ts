import { Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { RemoteOpenerConverterContribution, RemoteOpenerServicePath, RemoteOpenerBrowserServiceToken } from '../common';

import { RemoteOpenerContributionClient } from './remote.opener.contribution';
import { RemoteOpenerBrowserServiceImpl } from './remote.opener.service';

export * from './remote.opener.service';

@Injectable()
export class RemoteOpenerModule extends BrowserModule {
  contributionProvider = [RemoteOpenerConverterContribution];
  providers = [
    {
      token: RemoteOpenerBrowserServiceToken,
      useClass: RemoteOpenerBrowserServiceImpl,
    },
    RemoteOpenerContributionClient,
  ];
  backServices = [
    {
      servicePath: RemoteOpenerServicePath,
      clientToken: RemoteOpenerBrowserServiceToken,
    },
  ];
}
