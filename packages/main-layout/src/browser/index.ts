import { Provider, Injectable } from '@ali/common-di';
import { CommandContribution, ConstructorOf } from '@ali/ide-core-common';
import { SlotMap, SlotLocation, BrowserModule } from '@ali/ide-core-browser';
import { MainLayout } from './main-layout.view';
import { MainLayoutContribution } from './main-layout.contribution';

@Injectable()
export class MainLayoutModule extends BrowserModule {
  providers: Provider[] = [];

  contributionsCls: Array<ConstructorOf<CommandContribution>> = [
    MainLayoutContribution,
  ];

  slotMap: SlotMap = new Map([
    [SlotLocation.main, MainLayout],
  ]);
}
