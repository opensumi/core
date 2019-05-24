import { Provider, Injectable } from '@ali/common-di';
import { SlotMap } from '@ali/ide-core-browser';
import { BrowserModule } from '@ali/ide-core-browser';
import { Terminal } from './terminal.view';
import { SlotLocation } from '@ali/ide-main-layout';

@Injectable()
export class TerminalModule extends BrowserModule {
  providers: Provider[] = [];
  slotMap: SlotMap = new Map([
    [ SlotLocation.bottomPanel, Terminal ],
  ]);
}
