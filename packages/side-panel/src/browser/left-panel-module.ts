import * as React from 'react';
import { BrowserModule } from '@ali/ide-core-browser';
import { SlotLocation } from '@ali/ide-main-layout';
import { SidePanel } from './left-panel.view';
import { Injectable } from '@ali/common-di';

@Injectable()
export class LeftPanelModule extends BrowserModule {
  providers = [];
  slotMap = new Map([
    // TODO 需要同时在两个地方注入不同的实例
    [SlotLocation.leftPanel, SidePanel],
  ]);
}
