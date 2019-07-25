import { Provider, Injectable } from '@ali/common-di';
import { MainLayout } from './main-layout.view';
import { MainLayoutContribution } from './main-layout.contribution';
import { BrowserModule } from '@ali/ide-core-browser';
import { IMainLayoutService } from '../common';
import { MainLayoutService } from './main-layout.service';

@Injectable()
export class MainLayoutModule extends BrowserModule {
  providers: Provider[] = [
    MainLayoutContribution,
    {
      token: IMainLayoutService,
      useClass: MainLayoutService,
    },
  ];
  component: React.FunctionComponent = MainLayout;
}
