import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { SlotMap } from '@ali/ide-core-browser';
import { BrowserModule } from '@ali/ide-core-browser';
import { SlotLocation } from '@ali/ide-main-layout';
import { MenuBar } from './menu-bar.view';

@Injectable()
export class MenuBarModule extends BrowserModule {
  providers: Provider[] = [];

  slotMap: SlotMap = new Map([
    [SlotLocation.menuBar, MenuBar],
  ]);

  component = MenuBar;
}
