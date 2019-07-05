import * as React from 'react';
import { Provider } from '@ali/common-di';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';
import { ActivationEventService } from './types';
import { ActivationEventServiceImpl } from './activation.service';
export * from './types';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class ActivationEventModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: ActivationEventService,
      useClass: ActivationEventServiceImpl,
    },
  ];

}
