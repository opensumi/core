import { Provider, Injectable } from '@ali/common-di';
import { SlotMap } from '@ali/ide-core-browser';
import { SlotLocation, BrowserModule } from '@ali/ide-core-browser';
import { MainLayout } from './main-layout.view';
import { MainLayoutContribution } from './main-layout.contribution';

@Injectable()
export class MainLayoutModule extends BrowserModule {
  providers: Provider[] = [];

  slotMap: SlotMap = new Map([
    [SlotLocation.main, MainLayout],
  ]);

  contributionsCls = [
    MainLayoutContribution,
  ];
}
