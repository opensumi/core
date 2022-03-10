/* istanbul ignore file */
import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { MenuBarContribution } from './menu-bar.contribution';
import { AbstractMenubarStore, MenubarStore } from './menu-bar.store';
import { MenuBar } from './menu-bar.view';

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
