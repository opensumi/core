import { Provider } from '@ali/common-di';
import { SlotMap } from '@ali/ide-core-browser';
import { BrowserModule } from '@ali/ide-core-browser';
import { SlotLocation } from '@ali/ide-main-layout';
import { MenuBar } from './menu-bar.view';

export class MenuBarModule extends BrowserModule {
  providers: Provider[] = [];

  slotMap: SlotMap = new Map([
    [SlotLocation.menuBar, MenuBar],
  ]);
}
