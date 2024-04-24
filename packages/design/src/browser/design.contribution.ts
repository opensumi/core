import { Autowired, Injectable } from '@opensumi/di';
import {
  AINativeConfigService,
  AppConfig,
  ClientAppContribution,
  Domain,
  SlotLocation,
  SlotRendererContribution,
  SlotRendererRegistry,
} from '@opensumi/ide-core-browser';
import { LayoutViewSizeConfig } from '@opensumi/ide-core-browser/lib/layout/constants';
import { Schemes } from '@opensumi/ide-core-common';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { FileServiceClient } from '@opensumi/ide-file-service/lib/browser/file-service-client';

import { DesignMenubarLayoutConfig } from './layout/layout-config';
import { DesignBottomTabRenderer, DesignLeftTabRenderer, DesignRightTabRenderer } from './layout/tabbar.view';
import { DesignThemeFileSystemProvider } from './theme/file-system.provider';

@Injectable()
@Domain(ClientAppContribution, SlotRendererContribution)
export class DesignCoreContribution implements ClientAppContribution, SlotRendererContribution {
  @Autowired(IFileServiceClient)
  protected readonly fileSystem: FileServiceClient;

  @Autowired()
  private readonly designThemeFileSystemProvider: DesignThemeFileSystemProvider;

  @Autowired(AINativeConfigService)
  private readonly aiNativeConfigService: AINativeConfigService;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(LayoutViewSizeConfig)
  private layoutViewSize: LayoutViewSizeConfig;

  initialize() {
    const { useMenubarView } = this.aiNativeConfigService.layout;

    this.fileSystem.registerProvider(Schemes.design, this.designThemeFileSystemProvider);
    let layoutConfig = this.appConfig.layoutConfig;

    if (useMenubarView) {
      this.layoutViewSize.setMenubarHeight(48);
      layoutConfig = {
        ...layoutConfig,
        ...DesignMenubarLayoutConfig,
      };
    }

    this.layoutViewSize.setEditorTabsHeight(36);
    this.layoutViewSize.setStatusBarHeight(36);
    this.layoutViewSize.setAccordionHeaderSizeHeight(36);

    this.appConfig.layoutConfig = layoutConfig;
  }

  registerRenderer(registry: SlotRendererRegistry): void {
    registry.registerSlotRenderer(SlotLocation.left, DesignLeftTabRenderer);
    registry.registerSlotRenderer(SlotLocation.bottom, DesignBottomTabRenderer);
    registry.registerSlotRenderer(SlotLocation.right, DesignRightTabRenderer);
  }
}
