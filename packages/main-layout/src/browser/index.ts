import { Provider, Injectable, Injector } from '@ali/common-di';
import { MainLayout } from './main-layout.view';
import { MainLayoutModuleContribution } from './main-layout.contribution';
import { BrowserModule } from '@ali/ide-core-browser';
import { IMainLayoutService, MainLayoutContribution } from '../common';
import { MainLayoutService } from './main-layout.service';
import { TabbarServiceFactory, TabbarServiceManager } from './tabbar/tabbar.service';

@Injectable()
export class MainLayoutModule extends BrowserModule {
  providers: Provider[] = [
    MainLayoutModuleContribution,
    {
      token: IMainLayoutService,
      useClass: MainLayoutService,
    },
    {
      token: TabbarServiceFactory,
      useFactory: (injector: Injector) => {
        return (side: string) => {
          const manager = injector.get(TabbarServiceManager);
          return manager.getService(side);
        };
      },
    },
  ];
  contributionProvider = MainLayoutContribution;
  component: React.FunctionComponent = MainLayout;
}
