import { Provider, Injectable } from '@ali/common-di';
import { SlotMap } from '@ali/ide-core-browser';
import { BrowserModule } from '@ali/ide-core-browser';
import { BottomPanel } from './bottom-panel.view';
import { SlotLocation } from '@ali/ide-main-layout';
import { BottomPanelContribution } from './bottom-panel-contribution';
import { isFlowBaseAnnotation } from '@babel/types';

@Injectable()
export class BottomPanelModule extends BrowserModule {
  providers: Provider[] = [
    BottomPanelContribution,
  ];
  slotMap: SlotMap = new Map([
    [ SlotLocation.bottomPanel, BottomPanel ],
  ]);
}
