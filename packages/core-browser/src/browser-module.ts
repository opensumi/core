import { BasicModule } from '@ali/ide-core';
import { FunctionComponent } from 'react';

export type SlotMap = Map<string | symbol, FunctionComponent>;

export interface BrowserModule extends BasicModule {
  slotMap: SlotMap;
}
