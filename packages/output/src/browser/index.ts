import { Provider, Injectable } from '@ali/common-di';
import { SlotMap } from '@ali/ide-core-browser';
import { BrowserModule, SlotLocation } from '@ali/ide-core-browser';
import { OutputContribution } from './output-contribution';

@Injectable()
export class OutputModule extends BrowserModule {
  providers: Provider[] = [
    OutputContribution,
  ];
  slotMap: SlotMap = new Map([
  ]);
}
