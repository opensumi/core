import * as React from 'react';
import { BrowserModule } from '@ali/ide-core-browser';
import { SlotLocation } from '@ali/ide-main-layout';
import MonacoServiceImpl from './monaco.service';
import { createMonacoServiceProvider } from '../common';
export { default as MonacoService } from './monaco.service'

export class MonacoModule extends BrowserModule {
  providers = [
    createMonacoServiceProvider(MonacoServiceImpl)
  ];
  slotMap = new Map();
}
