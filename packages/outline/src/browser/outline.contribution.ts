import { Autowired } from '@opensumi/di';
import {
  OUTLINE_COMMANDS,
  Domain,
  localize,
  TabBarToolbarContribution,
  ToolbarRegistry,
  CommandContribution,
  CommandRegistry,
  IContextKeyService,
} from '@opensumi/ide-core-browser';
import { getIcon } from '@opensumi/ide-core-browser';
import { OutlineSortTypeContext, OutlineFollowCursorContext } from '@opensumi/ide-core-browser/lib/contextkey';
import { ExplorerContainerId } from '@opensumi/ide-explorer/lib/browser/explorer-contribution';
import { MainLayoutContribution, IMainLayoutService } from '@opensumi/ide-main-layout';

import { OutlineSortOrder } from '../common';

import { OutlinePanel } from './outline';
import { OutlineModelService } from './services/outline-model.service';
import { OutlineTreeService } from './services/outline-tree.service';

@Domain(MainLayoutContribution, TabBarToolbarContribution, CommandContribution)
export class OutlineContribution implements MainLayoutContribution, TabBarToolbarContribution, CommandContribution {
  @Autowired(IMainLayoutService)
  private mainLayoutService: IMainLayoutService;

  @Autowired()
  private outlineTreeService: OutlineTreeService;

  @Autowired()
  private outlineTreeModelService: OutlineModelService;

  @Autowired(IContextKeyService)
  contextKey: IContextKeyService;

  onDidRender() {
    this.mainLayoutService.collectViewComponent(
      {
        component: OutlinePanel,
        collapsed: true,
        id: 'outline-view',
        name: localize('outline.title'),
      },
      ExplorerContainerId,
    );
  }

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand(
      {
        id: OUTLINE_COMMANDS.OUTLINE_COLLAPSE_ALL.id,
        iconClass: getIcon('collapse-all'),
        label: localize('outline.collapse.all'),
      },
      {
        execute: () => {
          this.outlineTreeModelService.collapseAll();
        },
      },
    );
    registry.registerCommand(
      {
        id: OUTLINE_COMMANDS.OUTLINE_FOLLOW_CURSOR.id,
        iconClass: getIcon('follow-cursor'),
        toogleIconClass: getIcon('follow-cursor', { fill: true }),
        label: localize('outline.follow.cursor'),
      },
      {
        execute: () => {
          this.outlineTreeService.followCursor = !this.outlineTreeService.followCursor;
        },
      },
    );
    registry.registerCommand(
      {
        id: OUTLINE_COMMANDS.OUTLINE_SORT_KIND.id,
        label: localize('outline.sort.kind'),
      },
      {
        execute: () => {
          this.outlineTreeService.sortType = OutlineSortOrder.ByKind;
        },
      },
    );
    registry.registerCommand(
      {
        id: OUTLINE_COMMANDS.OUTLINE_SORT_NAME.id,
        label: localize('outline.sort.name'),
      },
      {
        execute: () => {
          this.outlineTreeService.sortType = OutlineSortOrder.ByName;
        },
      },
    );
    registry.registerCommand(
      {
        id: OUTLINE_COMMANDS.OUTLINE_SORT_POSITION.id,
        label: localize('outline.sort.position'),
      },
      {
        execute: () => {
          this.outlineTreeService.sortType = OutlineSortOrder.ByPosition;
        },
      },
    );
  }

  registerToolbarItems(registry: ToolbarRegistry) {
    registry.registerItem({
      id: 'outline.action.follow.cursor',
      viewId: 'outline-view',
      command: OUTLINE_COMMANDS.OUTLINE_FOLLOW_CURSOR.id,
      label: localize('outline.follow.cursor'),
      toggledWhen: OutlineFollowCursorContext.raw,
    });
    registry.registerItem({
      id: 'outline.action.collapse.all',
      viewId: 'outline-view',
      command: OUTLINE_COMMANDS.OUTLINE_COLLAPSE_ALL.id,
      label: localize('outline.collapse.all'),
    });
    registry.registerItem({
      id: 'outline.menu.sort.kind',
      viewId: 'outline-view',
      command: OUTLINE_COMMANDS.OUTLINE_SORT_KIND.id,
      group: 'inline',
      toggledWhen: `${OutlineSortTypeContext.raw} == ${OutlineSortOrder.ByKind}`,
    });
    registry.registerItem({
      id: 'outline.menu.sort.name',
      viewId: 'outline-view',
      command: OUTLINE_COMMANDS.OUTLINE_SORT_NAME.id,
      group: 'inline',
      toggledWhen: `${OutlineSortTypeContext.raw} == ${OutlineSortOrder.ByName}`,
    });
    registry.registerItem({
      id: 'outline.menu.sort.position',
      viewId: 'outline-view',
      command: OUTLINE_COMMANDS.OUTLINE_SORT_POSITION.id,
      group: 'inline',
      toggledWhen: `${OutlineSortTypeContext.raw} == ${OutlineSortOrder.ByPosition}`,
    });
  }
}
