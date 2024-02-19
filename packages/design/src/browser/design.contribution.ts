import { Injectable } from '@opensumi/di';
import {
  ClientAppContribution,
  Domain,
  SlotLocation,
  SlotRendererContribution,
  SlotRendererRegistry,
} from '@opensumi/ide-core-browser';

import { DesignBottomTabRenderer, DesignLeftTabRenderer } from './layout/tabbar.view';

@Injectable()
@Domain(ClientAppContribution, SlotRendererContribution)
export class DesignCoreContribution implements ClientAppContribution, SlotRendererContribution {
  onStart() {}

  registerRenderer(registry: SlotRendererRegistry): void {
    registry.registerSlotRenderer(SlotLocation.left, DesignLeftTabRenderer);
    registry.registerSlotRenderer(SlotLocation.bottom, DesignBottomTabRenderer);
  }
}
