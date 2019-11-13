import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';

import { MenuBar } from './menu-bar.view';
import { MenuBarContribution } from './menu-bar.contribution';
import { MenubarService, AbstractMenubarService } from './menu-bar.service';

@Injectable()
export class MenuBarModule extends BrowserModule {
  providers: Provider[] = [
    MenuBarContribution,
    {
      token: AbstractMenubarService,
      useClass: MenubarService,
    },
  ];

  component = MenuBar;
}
