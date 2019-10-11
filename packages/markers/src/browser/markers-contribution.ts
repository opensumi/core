import { Autowired } from '@ali/common-di';
import { Domain, ComponentContribution, ComponentRegistry, Logger } from '@ali/ide-core-browser';
import { MainLayoutContribution, IMainLayoutService } from '@ali/ide-main-layout';
import { Markers } from './markers.view';

@Domain(ComponentContribution, MainLayoutContribution)
export class MarkersContribution implements ComponentContribution, MainLayoutContribution {

  @Autowired()
  logger: Logger;

  @Autowired(IMainLayoutService)
  protected readonly mainlayoutService: IMainLayoutService;

  onDidUseConfig() {
  }

  registerComponent(registry: ComponentRegistry): void {
    registry.register('@ali/ide-markers', {
      id: 'ide-markers',
      component: Markers,
    }, {
      title: '问题',
      priority: 11,
      containerId: 'ide-markers',
    });
  }

}
