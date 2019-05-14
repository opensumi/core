import * as React from 'react';
import { RenderNameEnum, BrowserModule } from '@ali/ide-core-browser';
import { MenuBar } from './menu-bar.view';
import { createMenuBarAPIProvider } from '../common';

export class MenuBarModule extends BrowserModule {
  providers = [
  ];

  slotMap = new Map([
    [RenderNameEnum.menuBar, MenuBar],
  ]);
}
