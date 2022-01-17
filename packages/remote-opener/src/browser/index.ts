import { Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { RemoteOpenerBrowserServiceToken } from '@opensumi/ide-core-browser/lib/remote-opener';

import { RemoteOpenerServicePath } from '../common';
import { RemoteOpenerBrowserServiceImpl } from './remote.opener.service';

export * from './remote.opener.service';

@Injectable()
export class RemoteOpenerModule extends BrowserModule {
  providers = [
    {
      token: RemoteOpenerBrowserServiceToken,
      useClass: RemoteOpenerBrowserServiceImpl,
    },
  ];
  backServices = [
    {
      servicePath: RemoteOpenerServicePath,
      clientToken: RemoteOpenerBrowserServiceToken,
    },
  ];
}
