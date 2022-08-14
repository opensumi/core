import { Autowired } from '@opensumi/di';
import {
  CommandContribution,
  CommandRegistry,
  ComponentContribution,
  ComponentRegistry,
  Domain,
  Logger,
} from '@opensumi/ide-core-browser';
import { IMainLayoutService, MainLayoutContribution } from '@opensumi/ide-main-layout';

import { IMarkerService, MARKER_CONTAINER_ID } from '../common';

import { MarkerFilterPanel } from './markers-filter.view';
import { MarkerService } from './markers-service';
import { MarkerPanel } from './markers-tree.view';
import Messages from './messages';

export namespace MARKER_COMMANDS {
  export const SHOW_ERRORS_WARNINGS = {
    id: 'workbench.action.showErrorsWarnings',
  };
}

@Domain(CommandContribution, ComponentContribution, MainLayoutContribution)
export class MarkersContribution implements CommandContribution, ComponentContribution, MainLayoutContribution {
  @Autowired()
  logger: Logger;

  @Autowired(IMainLayoutService)
  protected readonly mainlayoutService: IMainLayoutService;

  @Autowired(IMarkerService)
  protected readonly markerService: MarkerService;

  onDidRender() {
    const handler = this.mainlayoutService.getTabbarHandler(MARKER_CONTAINER_ID);
    if (handler) {
      this.markerService.getManager().onMarkerChanged(() => {
        const badge = this.markerService.getBadge();
        handler.setBadge(badge || '');
      });
    }
  }

  registerComponent(registry: ComponentRegistry): void {
    registry.register(
      '@opensumi/ide-markers',
      {
        id: MARKER_CONTAINER_ID,
        component: MarkerPanel,
      },
      {
        title: Messages.markerTitle(),
        priority: 11,
        containerId: MARKER_CONTAINER_ID,
        activateKeyBinding: 'ctrlcmd+shift+m',
        titleComponent: MarkerFilterPanel,
      },
    );
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      { id: MARKER_COMMANDS.SHOW_ERRORS_WARNINGS.id },
      {
        execute: () => {
          const tabbarHandler = this.mainlayoutService.getTabbarHandler(MARKER_CONTAINER_ID);
          tabbarHandler?.activate();
        },
      },
    );
  }
}
