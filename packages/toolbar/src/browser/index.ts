import { Provider, Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import {
  BrowserModule,
  Domain,
  AppConfig,
  ClientAppContribution,
  ContributionProvider,
  ToolBarActionContribution,
  IToolbarRegistry,
} from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';

import { ToolBar } from './toolbar.view';
import { ToolBarViewService } from './toolbar.view.service';
import { IToolBarViewService, ToolBarContribution } from './types';
export * from './types';

@Injectable()
export class ToolbarModule extends BrowserModule {
  providers: Provider[] = [
    ToolBarModuleContribution,
    {
      token: IToolBarViewService,
      useClass: ToolBarViewService,
    },
  ];
  contributionProvider = ToolBarContribution;
}

@Domain(ComponentContribution, ClientAppContribution, ToolBarActionContribution)
export class ToolBarModuleContribution
  implements ComponentContribution, ClientAppContribution, ToolBarActionContribution
{
  @Autowired(AppConfig)
  config: AppConfig;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(ToolBarContribution)
  contributions: ContributionProvider<ToolBarContribution>;

  registerComponent(registry: ComponentRegistry): void {
    registry.register('toolbar', {
      id: 'toolbar',
      component: ToolBar,
    });
  }

  onStart() {
    this.contributions.getContributions().forEach((c) => {
      c.registerToolBarElement(this.injector.get(IToolBarViewService));
    });
  }

  registerToolbarActions(registry: IToolbarRegistry) {
    registry.addLocation('toolbar-left');
    registry.addLocation('toolbar-center');
    registry.addLocation('toolbar-right');
  }
}
