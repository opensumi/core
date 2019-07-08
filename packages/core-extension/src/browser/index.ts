import * as React from 'react';
import { Provider, Autowired, INJECTOR_TOKEN, Inject, Injector } from '@ali/common-di';
import { BrowserModule, EffectDomain, ClientAppContribution, Domain } from '@ali/ide-core-browser';
import { CoreExtensionService } from './core-extension.service';
import { CoreExtensionNodeServiceServerPath } from '../common';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class CoreExtensionModule extends BrowserModule {
  providers: Provider[] = [
    CoreExtensionClientAppContribution,
  ];

  backServices = [{
    servicePath: CoreExtensionNodeServiceServerPath,
  }];

}

@Domain(ClientAppContribution)
export class CoreExtensionClientAppContribution implements ClientAppContribution {

  @Autowired()
  coreExtensionService: CoreExtensionService;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  async initialize() {
    await this.coreExtensionService.activate();
  }

}
