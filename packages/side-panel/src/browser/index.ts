import * as React from 'react';
import { BrowserModule } from '@ali/ide-core-browser';
import { SlotLocation } from '@ali/ide-main-layout';
import { SidePanel } from './side-panel.view';

export class SidePanelModule extends BrowserModule {
  providers = [];
  slotMap = new Map([
    [SlotLocation.leftPanel, SidePanel],
  ]);
}
