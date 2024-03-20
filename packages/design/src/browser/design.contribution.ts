import { Autowired, Injectable } from '@opensumi/di';
import {
  ClientAppContribution,
  Domain,
  SlotLocation,
  SlotRendererContribution,
  SlotRendererRegistry,
} from '@opensumi/ide-core-browser';
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

  async initialize() {
    this.fileSystem.registerProvider(Schemes.design, this.designThemeFileSystemProvider);
  }

  registerRenderer(registry: SlotRendererRegistry): void {
    registry.registerSlotRenderer(SlotLocation.left, DesignLeftTabRenderer);
    registry.registerSlotRenderer(SlotLocation.bottom, DesignBottomTabRenderer);
    registry.registerSlotRenderer(SlotLocation.right, DesignRightTabRenderer);
  }
}
