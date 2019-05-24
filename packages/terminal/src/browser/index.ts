import { Provider, Injectable } from '@ali/common-di';
import { SlotMap } from '@ali/ide-core-browser';
import { BrowserModule, SlotLocation } from '@ali/ide-core-browser';
import { Terminal } from './terminal.view';

@Injectable()
export class TerminalModule extends BrowserModule {
  providers: Provider[] = [];
  slotMap: SlotMap = new Map([
    [ SlotLocation.main, Terminal ],
  ]);
}
