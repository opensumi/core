import { Provider, Injectable, Injector } from '@ali/common-di';
import { MainLayout } from './main-layout.view';
import { MainLayoutModuleContribution } from './main-layout.contribution';
import { BrowserModule } from '@ali/ide-core-browser';
import { IMainLayoutService, MainLayoutContribution } from '../common';
import { MainLayoutService } from './main-layout.service';
import { TabbarServiceFactory } from './tabbar/tabbar.service';
import { LayoutService } from './layout.service';

@Injectable()
export class MainLayoutModule extends BrowserModule {
  providers: Provider[] = [
    MainLayoutModuleContribution,
    {
      token: IMainLayoutService,
      useClass: LayoutService,
    },
    {
      token: TabbarServiceFactory,
      useFactory: (injector: Injector) => {
        return (location: string) => {
          const manager = injector.get(IMainLayoutService);
          return manager.getTabbarService(location);
        };
      },
    },
  ];
  contributionProvider = MainLayoutContribution;
  component: React.FunctionComponent = MainLayout;
}
