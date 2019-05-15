import * as React from 'react';
import { SlotLocation, BrowserModule } from '@ali/ide-core-browser';
import { MainLayout } from './main-layout.view';

export class MainLayoutModule extends BrowserModule {
  providers = [];

  slotMap = new Map([
    [SlotLocation.main, MainLayout],
  ]);
}
