import * as React from 'react';
import { Provider, Injectable, Autowired } from '@ali/common-di';
import { BrowserModule, ComponentContribution, Domain, ComponentRegistry, localize, TabBarToolbarContribution, ToolbarRegistry, CommandContribution, CommandRegistry, IContextKeyService } from '@ali/ide-core-browser';
import { OutLineTree } from './outline.tree.view';
import { ExplorerContainerId } from '@ali/ide-explorer/lib/browser/explorer-contribution';
import { MainLayoutContribution, IMainLayoutService } from '@ali/ide-main-layout';
import { OutLineService } from './outline.service';
import { getIcon, ROTATE_TYPE } from '@ali/ide-core-browser';

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

  @Autowired(IContextKeyService)
  contextKey: IContextKeyService;

  onDidRender() {
    this.mainLayoutService.collectViewComponent({
      component: OutLineTree,
      collapsed: true,
      id: 'outline-view',
      name: localize('outline.title'),
    }, ExplorerContainerId);
  }

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand({
      id: OUTLINE_COLLAPSE_ALL,
      iconClass: getIcon('collapse-all'),
      label: localize('outline.collapse.all', '全部折叠'),
    }, {
      execute: () => {
        this.outlineService.collapseAll();
      },
    });
    registry.registerCommand({
      id: OUTLINE_FOLLOW_CURSOR,
      iconClass: getIcon('follow-cursor'),
      toogleIconClass: getIcon('follow-cursor', { fill: true }),
      label: localize('outline.follow.cursor', '跟随光标'),
    }, {
      execute: () => {
        this.outlineService.followCursor = !this.outlineService.followCursor;
        this.contextKey.createKey('followCursor', this.outlineService.followCursor);
      },
    });
  }

  registerToolbarItems(registry: ToolbarRegistry) {
    registry.registerItem({
      id: 'outline.action.follow.cursor',
      viewId: 'outline-view',
      command: OUTLINE_FOLLOW_CURSOR,
      tooltip: localize('outline.follow.cursor', '跟随光标'),
      toggleWhen: 'followCursor',
    });
    registry.registerItem({
      id: 'outline.action.collapse.all',
      viewId: 'outline-view',
      command: OUTLINE_COLLAPSE_ALL,
      tooltip: localize('outline.collapse.all', '全部折叠'),
    });
  }

}
