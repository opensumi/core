import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';

import { MenuBar } from './menu-bar.view';
import { MenuBarContribution } from './menu-bar.contribution';

@Injectable()
export class MenuBarModule extends BrowserModule {
  providers: Provider[] = [
    MenuBarContribution,
  ];
  component = MenuBar;
}
