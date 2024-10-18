import { Autowired } from '@opensumi/di';
import { Domain, localize } from '@opensumi/ide-core-browser';
import { EXPLORER_CONTAINER_ID } from '@opensumi/ide-explorer/lib/browser/explorer-contribution';
import { IMainLayoutService, MainLayoutContribution } from '@opensumi/ide-main-layout';

import { TocPanel } from './toc.panel';

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
