import * as React from 'react';
import { Provider, Injectable, Autowired } from '@ali/common-di';
import { BrowserModule, ComponentContribution, Domain, ComponentRegistry, localize } from '@ali/ide-core-browser';
import { OutLineTree } from './outline.tree.view';
import { ExplorerContainerId } from '../../../explorer/lib/browser/explorer-contribution';
import { MainLayoutContribution, IMainLayoutService } from '@ali/ide-main-layout';

@Injectable()
export class OutlineModule extends BrowserModule {
  providers: Provider[] = [
    OutlineContribution,
  ];

  component = OutLineTree;
}

@Domain(MainLayoutContribution)
export class OutlineContribution implements MainLayoutContribution {
  @Autowired(IMainLayoutService)
  mainLayoutService: IMainLayoutService;

  onDidUseConfig() {
    this.mainLayoutService.collectViewComponent({
      component: OutLineTree,
      id: 'outline-view',
      name: localize('outline.title'),
    }, ExplorerContainerId);
  }

}
