import { Provider, Injectable } from '@ali/common-di';
import { MainLayout } from './main-layout.view';
import { MainLayoutModuleContribution } from './main-layout.contribution';
import { BrowserModule } from '@ali/ide-core-browser';
import { IMainLayoutService } from '../common';
import { MainLayoutService } from './main-layout.service';
import { MainLayoutContribution } from './types';
export * from './types';

@Injectable()
export class MainLayoutModule extends BrowserModule {
  providers: Provider[] = [
    MainLayoutModuleContribution,
    {
      token: IMainLayoutService,
      useClass: MainLayoutService,
    },
  ];
  contributionProvider = MainLayoutContribution;
  component: React.FunctionComponent = MainLayout;
}
