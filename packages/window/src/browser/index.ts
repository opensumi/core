import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
// import { HelloWorld } from './hello-world.view';
import { WindowServiceImpl} from '../browser/window.service';
import {WindowService} from '../common';

@Injectable()
export class WindowModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: WindowService,
      useClass: WindowServiceImpl,
    },
  ];

  // component = HelloWorld;
}
