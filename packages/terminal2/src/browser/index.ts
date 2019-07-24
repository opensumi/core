import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';

@Injectable()
export class Terminal2Module extends BrowserModule {
  providers: Provider[] = [];

}
