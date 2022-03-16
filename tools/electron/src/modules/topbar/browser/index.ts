import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule, Domain } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';

import { ITopbarService, TopbarNodeServerPath } from '../common';

import { TopbarService } from './topbar.service';
import { Topbar } from './topbar.view';

@Injectable()
export class TopbarModule extends BrowserModule {
  providers: Provider[] = [
    TopbarContribution,
    {
      token: ITopbarService,
      useClass: TopbarService,
    },
  ];

  backServices = [
    {
      servicePath: TopbarNodeServerPath,
    },
  ];

  component = Topbar;
}

@Domain(ComponentContribution)
export class TopbarContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    registry.register(
      'topbar',
      {
        id: 'topbar',
        component: Topbar,
      },
      {
        size: 56,
      },
    );
  }

  registerRenderer() {}
}
