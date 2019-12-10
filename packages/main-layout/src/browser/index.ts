import { Provider, Injectable, Injector } from '@ali/common-di';
import { MainLayoutModuleContribution } from './main-layout.contribution';
import { BrowserModule } from '@ali/ide-core-browser';
import { IMainLayoutService, MainLayoutContribution } from '../common';
import { TabbarServiceFactory } from './tabbar/tabbar.service';
import { LayoutService } from './layout.service';
import { AccordionServiceFactory } from './accordion/accordion.service';

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
        return (location: string, noAccordion?: boolean) => {
          const manager: IMainLayoutService = injector.get(IMainLayoutService);
          return manager.getTabbarService(location, noAccordion);
        };
      },
    },
    {
      token: AccordionServiceFactory,
      useFactory: (injector: Injector) => {
        return (containerId: string) => {
          const manager: IMainLayoutService = injector.get(IMainLayoutService);
          return manager.getAccordionService(containerId);
        };
      },
    },
  ];
  contributionProvider = MainLayoutContribution;
}
