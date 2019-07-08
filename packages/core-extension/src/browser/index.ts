import * as React from 'react';
import { Provider, Autowired, INJECTOR_TOKEN, Inject, Injector } from '@ali/common-di';
import { BrowserModule, EffectDomain, ClientAppContribution, Domain } from '@ali/ide-core-browser';
import { CoreExtensionService } from './core-extension.service';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class CoreExtensionModule extends BrowserModule {
  providers: Provider[] = [
    CoreExtensionClientAppContribution,
  ];

}

@Domain(ClientAppContribution)
export class CoreExtensionClientAppContribution implements ClientAppContribution {

  @Autowired()
  coreExtensionService: CoreExtensionService;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  async initialize() {
    this.coreExtensionService.init();
    const modules = await this.coreExtensionService.loadBrowser('http://localhost:8000/ext/boilerplate/lib/browser/index.js');
    modules.forEach((m) => {
      const a = this.injector.get(m as any);
      this.injector.addProviders(...a.providers);
    });
  }

}
