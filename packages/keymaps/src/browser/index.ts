import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { KeymapsContribution } from './keymaps.contribution';

@Injectable()
export class KeymapsModule extends BrowserModule {
  providers: Provider[] = [
    KeymapsContribution,
  ];

}
