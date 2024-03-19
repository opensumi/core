import { Autowired } from '@opensumi/di';
import {
  CommandContribution,
  CommandRegistry,
  ComponentContribution,
  ComponentRegistry,
  Disposable,
  Domain,
  IStatusBarService,
  Logger,
  MARKER_COMMANDS,
  StatusBarAlignment,
  localize,
} from '@opensumi/ide-core-browser';
import { IMainLayoutService, MainLayoutContribution } from '@opensumi/ide-main-layout';

import { IMarkerService, MARKER_CONTAINER_ID } from '../common';

import { MarkerFilterPanel } from './markers-filter.view';
import { MarkerService } from './markers-service';
import { MarkerPanel } from './markers-tree.view';
import Messages from './messages';
import { MarkerModelService } from './tree/tree-model.service';

function normalize(num: number) {
  const limit = 100;
  const msg = `${limit - 1}+`;
  if (num >= limit) {
    return msg;
  }
  return num.toString();
}

@Domain(CommandContribution, ComponentContribution, MainLayoutContribution)
export class MarkersContribution
  extends Disposable
  implements CommandContribution, ComponentContribution, MainLayoutContribution
{
  @Autowired()
  logger: Logger;

  @Autowired(IMainLayoutService)
  protected readonly mainlayoutService: IMainLayoutService;

  @Autowired(IMarkerService)
  protected readonly markerService: MarkerService;
  @Autowired(IStatusBarService)
  private readonly statusBar: IStatusBarService;

  @Autowired(MarkerModelService)
  private readonly markerModelService: MarkerModelService;

  onDidRender() {
    const handler = this.mainlayoutService.getTabbarHandler(MARKER_CONTAINER_ID);
    if (handler) {
      this.addDispose(
        this.markerService.getManager().onMarkerChanged(() => {
          const badge = this.markerService.getBadge();
          handler.setBadge(badge || '');
        }),
      );

      this.markerService.viewReady.then(() => {
        const activate = handler.isActivated();
        if (activate) {
          this.markerModelService.activate();
        }
      });

      this.addDispose(
        handler.onActivate(() => {
          this.markerModelService.activate();
        }),
      );
      this.addDispose(
        handler.onInActivate(() => {
          this.markerModelService.deactivate();
        }),
      );
    }
    this.updateStatusBar();
    this.addDispose(
      this.markerService.getManager().onMarkerChanged(() => {
        this.updateStatusBar();
      }),
    );
  }

  statusBarId = 'markers-status';
  updateStatusBar() {
    const markerManager = this.markerService.getManager();
    const stats = markerManager.getStats();
    if (stats) {
      const tooltipString = [] as string[];
      const iconTexts = [
        `$(codicon/error) ${normalize(stats.errors)}`,
        `$(codicon/warning) ${normalize(stats.warnings)}`,
      ];
      if (stats.errors > 0) {
        tooltipString.push(`Errors(${stats.errors})`);
      }
      if (stats.warnings > 0) {
        tooltipString.push(`Warnings(${stats.warnings})`);
      }
      if (stats.infos > 0) {
        tooltipString.push(`Infos(${stats.infos})`);
        iconTexts.push(`$(codicon/info) ${normalize(stats.infos)}`);
      }
      this.statusBar.addElement(this.statusBarId, {
        name: localize('status-bar.editor-langStatus'),
        alignment: StatusBarAlignment.LEFT,
        text: iconTexts.join(' '),
        priority: 1,
        tooltip: tooltipString.length > 0 ? tooltipString.join(', ') : localize('markers.status.no.problems'),
        onClick: () => {
          this.toggleMarkerTabbar();
        },
      });
    } else {
      this.statusBar.removeElement(this.statusBarId);
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

  showMarkerTabbar() {
    const tabbarHandler = this.mainlayoutService.getTabbarHandler(MARKER_CONTAINER_ID);
    tabbarHandler?.activate();
  }

  toggleMarkerTabbar() {
    const tabbarHandler = this.mainlayoutService.getTabbarHandler(MARKER_CONTAINER_ID);
    if (tabbarHandler) {
      tabbarHandler.isActivated() ? tabbarHandler.deactivate() : tabbarHandler.activate();
    }
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      { id: MARKER_COMMANDS.SHOW_ERRORS_WARNINGS.id },
      {
        execute: () => {
          this.showMarkerTabbar();
        },
      },
    );

    commands.registerCommand(
      { id: MARKER_COMMANDS.TOGGLE_SHOW_ERRORS_WARNINGS.id },
      {
        execute: () => {
          this.toggleMarkerTabbar();
        },
      },
    );
  }
}
