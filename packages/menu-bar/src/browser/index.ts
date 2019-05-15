import * as React from 'react';
import { BrowserModule } from '@ali/ide-core-browser';
import { SlotLocation } from '@ali/ide-main-layout';
import { MenuBar } from './menu-bar.view';
import { createMenuBarAPIProvider } from '../common';

export class MenuBarModule extends BrowserModule {
  providers = [
  ];

  slotMap = new Map([
    [SlotLocation.menuBar, MenuBar],
  ]);
}
