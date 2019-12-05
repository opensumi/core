import { Provider, Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { BrowserModule, Domain, AppConfig, SlotLocation, ClientAppContribution, ContributionProvider } from '@ali/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { ToolBar } from './toolbar.view';
import { IToolBarViewService, ToolBarContribution } from './types';
import { ToolBarViewService } from './toolbar.view.service';
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

@Domain(ComponentContribution, ClientAppContribution)
export class ToolBarModuleContribution implements ComponentContribution, ClientAppContribution {

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
    }, {
      size: 27,
    });
  }

  onStart() {
    this.contributions.getContributions().forEach((c)  => {
      c.registerToolBarElement(this.injector.get(IToolBarViewService));
    });
  }

}
