import * as React from 'react';
import { BrowserModule } from '@ali/ide-core-browser';
import { SlotLocation } from '@ali/ide-main-layout';
import { Monaco } from './monaco.view';

export class MonacoModule extends BrowserModule {
  providers = [];
  slotMap = new Map([
    [SlotLocation.topPanel, Monaco],
  ]);
}
