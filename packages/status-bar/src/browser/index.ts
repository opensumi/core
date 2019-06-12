import { Provider, Injectable } from '@ali/common-di';
import { SlotMap } from '@ali/ide-core-browser';
import { BrowserModule } from '@ali/ide-core-browser';
import { SlotLocation } from '@ali/ide-main-layout';
import { StatusBarView } from './status-bar.view';
import { StatusBarService, StatusBar } from './status-bar.service';

@Injectable()
export class StatusBarModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: StatusBar,
      useClass: StatusBarService,
    },
  ];
  slotMap: SlotMap = new Map([
    [ SlotLocation.statusBar, StatusBarView ],
  ]);
}
