import { Injectable } from '@opensumi/common-di';
import { Domain } from '@opensumi/ide-core-common';
import { SlotRendererContribution, SlotRendererRegistry, SlotLocation } from '@opensumi/ide-core-browser';
import { RightTabRenderer } from './custom-tabbar-renderer';

@Injectable()
@Domain(SlotRendererContribution)
export class ViewContribution implements SlotRendererContribution {
  registerRenderer(registry: SlotRendererRegistry) {
    registry.registerSlotRenderer(SlotLocation.right, RightTabRenderer);
  }

}
