import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { ActivationEventService } from './types';
import { ActivationEventServiceImpl } from './activation.service';
export * from './types';

@Injectable()
export class ActivationEventModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: ActivationEventService,
      useClass: ActivationEventServiceImpl,
    },
  ];

}
