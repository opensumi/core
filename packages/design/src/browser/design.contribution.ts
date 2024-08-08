import { Autowired, Injectable } from '@opensumi/di';
import {
  ClientAppContribution,
  Domain,
  SlotLocation,
  SlotRendererContribution,
  SlotRendererRegistry,
} from '@opensumi/ide-core-browser';
import { ConfigPriority, LayoutViewSizeConfig } from '@opensumi/ide-core-browser/lib/layout/constants';
import { Schemes } from '@opensumi/ide-core-common';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { FileServiceClient } from '@opensumi/ide-file-service/lib/browser/file-service-client';

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

  initialize() {
    this.fileSystem.registerProvider(Schemes.design, this.designThemeFileSystemProvider);

    this.layoutViewSize.setEditorTabsHeight(36, ConfigPriority.ModuleDefined);
    this.layoutViewSize.setStatusBarHeight(36, ConfigPriority.ModuleDefined);
    this.layoutViewSize.setAccordionHeaderSizeHeight(36, ConfigPriority.ModuleDefined);
  }

  registerRenderer(registry: SlotRendererRegistry): void {
    registry.registerSlotRenderer(SlotLocation.left, DesignLeftTabRenderer);
    registry.registerSlotRenderer(SlotLocation.bottom, DesignBottomTabRenderer);
    registry.registerSlotRenderer(SlotLocation.right, DesignRightTabRenderer);
  }
}
