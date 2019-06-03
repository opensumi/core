import { Provider, Injectable } from '@ali/common-di';
import { SlotMap } from '@ali/ide-core-browser';
import { BrowserModule } from '@ali/ide-core-browser';
import { ActivatorPanel } from './activator-panel.view';
import { SlotLocation } from '@ali/ide-main-layout';

@Injectable()
export class ActivatorPanelModule extends BrowserModule {
  providers: Provider[] = [];
  slotMap: SlotMap = new Map([
    [ SlotLocation.activatorPanel, ActivatorPanel ],
  ]);
}
