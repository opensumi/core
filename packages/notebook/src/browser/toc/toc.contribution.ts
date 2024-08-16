import { Autowired } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-browser';
import { IMainLayoutService, MainLayoutContribution } from '@opensumi/ide-main-layout';

@Domain(MainLayoutContribution)
export class TocContribution implements MainLayoutContribution {
  @Autowired(IMainLayoutService)
  private mainLayoutService: IMainLayoutService;

  onDidRender() {
    // this.mainLayoutService.collectViewComponent(
    //   {
    //     component: TocPanel,
    //     collapsed: true,
    //     id: 'outline-view',
    //     name: localize('outline.title'),
    //   },
    //   EXPLORER_CONTAINER_ID,
    // );
  }
}
