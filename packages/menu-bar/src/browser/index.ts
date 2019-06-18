import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';

import { MenuBar } from './menu-bar.view';

@Injectable()
export class MenuBarModule extends BrowserModule {
  providers: Provider[] = [];
  component = MenuBar;
}
