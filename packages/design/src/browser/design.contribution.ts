import { Autowired, Injectable } from '@opensumi/di';
import {
  AppConfig,
  ClientAppContribution,
  ComponentRegistryImpl,
  Domain,
  SlotLocation,
  SlotRendererContribution,
  SlotRendererRegistry,
} from '@opensumi/ide-core-browser';
import { DesignLayoutConfig, LayoutViewSizeConfig } from '@opensumi/ide-core-browser/lib/layout/constants';
import { Schemes } from '@opensumi/ide-core-common';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { FileServiceClient } from '@opensumi/ide-file-service/lib/browser/file-service-client';

import { DESIGN_MENUBAR_CONTAINER_VIEW_ID } from '../common/constants';

import { DesignBottomTabRenderer, DesignLeftTabRenderer, DesignRightTabRenderer } from './layout/tabbar.view';
import { DesignThemeFileSystemProvider } from './theme/file-system.provider';

@Injectable()
@Domain(ClientAppContribution, SlotRendererContribution)
export class DesignCoreContribution implements ClientAppContribution, SlotRendererContribution {
  @Autowired(IFileServiceClient)
  protected readonly fileSystem: FileServiceClient;

  @Autowired()
  private readonly designThemeFileSystemProvider: DesignThemeFileSystemProvider;

  @Autowired(LayoutViewSizeConfig)
  private layoutViewSize: LayoutViewSizeConfig;

  @Autowired(DesignLayoutConfig)
  private designLayoutConfig: DesignLayoutConfig;

  initialize() {
    const { useMenubarView } = this.designLayoutConfig;

    this.fileSystem.registerProvider(Schemes.design, this.designThemeFileSystemProvider);

    if (useMenubarView) {
      this.layoutViewSize.setMenubarHeight(48);
    }

    this.layoutViewSize.setEditorTabsHeight(36);
    this.layoutViewSize.setStatusBarHeight(36);
    this.layoutViewSize.setAccordionHeaderSizeHeight(36);
  }

  registerRenderer(registry: SlotRendererRegistry): void {
    registry.registerSlotRenderer(SlotLocation.left, DesignLeftTabRenderer);
    registry.registerSlotRenderer(SlotLocation.bottom, DesignBottomTabRenderer);
    registry.registerSlotRenderer(SlotLocation.right, DesignRightTabRenderer);
  }
}
