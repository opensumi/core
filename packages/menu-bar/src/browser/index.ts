import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';

import { MenuBar } from './menu-bar.view';
import { MenuBarContribution } from './menu-bar.contribution';
import { AbstractMenubarStore, MenubarStore } from './menu-bar.store';

@Injectable()
export class MenuBarModule extends BrowserModule {
  providers: Provider[] = [
    MenuBarContribution,
    {
      token: AbstractMenubarStore,
      useClass: MenubarStore,
    },
  ];

  component = MenuBar;
}
