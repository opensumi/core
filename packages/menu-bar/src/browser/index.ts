import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { MenuBar } from './menu-bar.view';
import { BrowserModule } from '@ali/ide-core-browser';
import { MenuBarContribution } from './menu-bar.contribution';
import { MenuBarService } from './menu-bar.service';

@Injectable()
export class MenuBarModule extends BrowserModule {
  providers: Provider[] = [
    MenuBarContribution,
    MenuBarService,
  ];

  component = MenuBar;
}
