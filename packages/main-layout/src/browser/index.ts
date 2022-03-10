import { Provider, Injectable, Injector } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { IMainLayoutService, IViewsRegistry, MainLayoutContribution } from '../common';

import { AccordionServiceFactory } from './accordion/accordion.service';
import { LayoutService } from './layout.service';
import { MainLayoutModuleContribution } from './main-layout.contribution';
import { TabbarServiceFactory } from './tabbar/tabbar.service';
import { ViewsRegistry } from './views-registry';

@Injectable()
export class MainLayoutModule extends BrowserModule {
  providers: Provider[] = [
    MainLayoutModuleContribution,
    {
      token: IMainLayoutService,
      useClass: LayoutService,
    },
    {
      token: IViewsRegistry,
      useClass: ViewsRegistry,
    },
    {
      token: TabbarServiceFactory,
      useFactory: (injector: Injector) => (location: string) => {
        const manager: IMainLayoutService = injector.get(IMainLayoutService);
        return manager.getTabbarService(location);
      },
    },
    {
      token: AccordionServiceFactory,
      useFactory: (injector: Injector) => (containerId: string, noRestore?: boolean) => {
        const manager: IMainLayoutService = injector.get(IMainLayoutService);
        return manager.getAccordionService(containerId, noRestore);
      },
    },
  ];
  contributionProvider = MainLayoutContribution;
}
