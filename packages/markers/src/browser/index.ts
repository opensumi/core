import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { MarkersContribution } from './markers-contribution';

@Injectable()
export class MarkersModule extends BrowserModule {
  providers: Provider[] = [
    MarkersContribution,
  ];
}
