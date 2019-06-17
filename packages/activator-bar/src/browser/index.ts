import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { SlotMap } from '@ali/ide-core-browser';
import { BrowserModule } from '@ali/ide-core-browser';
import { ActivatorBar } from './activator-bar.view';
import { SlotLocation } from '@ali/ide-main-layout';

@Injectable()
export class ActivatorBarModule extends BrowserModule {
  providers: Provider[] = [];
  slotMap: SlotMap = new Map([
    [ SlotLocation.activatorBar, ActivatorBar ],
  ]);

  component = ActivatorBar;
}
