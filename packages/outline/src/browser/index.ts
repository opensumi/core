import * as React from 'react';
import { Provider, Injectable, Autowired } from '@ali/common-di';
import { BrowserModule, ComponentContribution, Domain, ComponentRegistry, localize, TabBarToolbarContribution, TabBarToolbarRegistry, CommandContribution, CommandRegistry } from '@ali/ide-core-browser';
import { OutLineTree } from './outline.tree.view';
import { ExplorerContainerId } from '../../../explorer/lib/browser/explorer-contribution';
import { MainLayoutContribution, IMainLayoutService } from '@ali/ide-main-layout';
import { OutLineService } from './outline.service';
import { getIcon, ROTATE_TYPE } from '@ali/ide-core-browser/lib/icon';

export const OUTLINE_COLLAPSE_ALL = 'outline.collapse.all';
export const OUTLINE_FOLLOW_CURSOR = 'outline.follow.cursor';

@Injectable()
export class OutlineModule extends BrowserModule {
  providers: Provider[] = [
    OutlineContribution,
  ];

  component = OutLineTree;
}

@Domain(MainLayoutContribution, TabBarToolbarContribution, CommandContribution)
export class OutlineContribution implements MainLayoutContribution, TabBarToolbarContribution, CommandContribution {
  @Autowired(IMainLayoutService)
  mainLayoutService: IMainLayoutService;

  @Autowired()
  outlineService: OutLineService;

  onDidUseConfig() {
    this.mainLayoutService.collectViewComponent({
      component: OutLineTree,
      id: 'outline-view',
      name: localize('outline.title'),
    }, ExplorerContainerId);
  }

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand({
      id: OUTLINE_COLLAPSE_ALL,
      iconClass: getIcon('collapse-all'),
    }, {
      execute: () => {
        this.outlineService.collapseAll();
      },
    });
    registry.registerCommand({
      id: OUTLINE_FOLLOW_CURSOR,
      iconClass: getIcon('follow-cursor'),
      toogleIconClass: getIcon('follow-cursor', ROTATE_TYPE.rotate_180),
    }, {
      execute: () => {
        this.outlineService.followCursor = !this.outlineService.followCursor;
      },
      isToggled: () => this.outlineService.followCursor,
    });
  }

  registerToolbarItems(registry: TabBarToolbarRegistry) {
    registry.registerItem({
      id: 'outline.action.collapse.all',
      viewId: 'outline-view',
      command: OUTLINE_COLLAPSE_ALL,
      tooltip: localize('outline.collapse.all', '全部折叠'),
    });
    registry.registerItem({
      id: 'outline.action.follow.cursor',
      viewId: 'outline-view',
      command: OUTLINE_FOLLOW_CURSOR,
      tooltip: localize('outline.follow.cursor', '跟随光标'),
    });
  }

}
