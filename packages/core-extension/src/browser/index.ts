import * as React from 'react';
import { Provider, Autowired, INJECTOR_TOKEN, Inject, Injector, Injectable } from '@ali/common-di';
import { BrowserModule, ClientAppContribution, Domain } from '@ali/ide-core-browser';
import { CoreExtensionService } from './core-extension.service';
import { CoreExtensionNodeServiceServerPath } from '../common';

@Injectable()
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
