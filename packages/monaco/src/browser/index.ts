import * as React from 'react';
import { BrowserModule } from '@ali/ide-core-browser';

import MonacoServiceImpl from './monaco.service';
import { createMonacoServiceProvider } from '../common';
import { Injectable, Provider } from '@ali/common-di';
export { default as MonacoService } from './monaco.service';

@Injectable()
export class MonacoModule extends BrowserModule {
  providers: Provider[] = [
    createMonacoServiceProvider(MonacoServiceImpl),
  ];
  slotMap = new Map();
}
