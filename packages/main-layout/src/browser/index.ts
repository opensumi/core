import * as React from 'react';
import { RenderNameEnum, BrowserModule } from '@ali/ide-core-browser';
import { MainLayout } from './main-layout.view';

export class MainLayoutModule extends BrowserModule {
  providers = [];

  slotMap = new Map([
    [RenderNameEnum.mainLayout, MainLayout],
  ]);
}
