import { BasicModule } from '../common';
import { Component, FunctionComponent } from 'react';

export type SlotMap = Map<string | symbol, FunctionComponent>;

export interface BrowserModule extends BasicModule {
  slotMap: SlotMap;
}
