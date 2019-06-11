import { Provider, Injectable } from '@ali/common-di';
import { SlotMap } from '@ali/ide-core-browser';
import { BrowserModule } from '@ali/ide-core-browser';
import { TerminalContribution } from './terminal-contribution';

@Injectable()
export class TerminalModule extends BrowserModule {
  providers: Provider[] = [
    TerminalContribution,
  ];
  slotMap: SlotMap = new Map([
  ]);
}
