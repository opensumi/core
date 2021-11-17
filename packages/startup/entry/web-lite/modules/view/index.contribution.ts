import { Injectable } from '@ide-framework/common-di';
import { Domain } from '@ide-framework/ide-core-common';
import { SlotRendererContribution, SlotRendererRegistry, SlotLocation } from '@ide-framework/ide-core-browser';
import { RightTabRenderer } from './custom-tabbar-renderer';

@Injectable()
@Domain(SlotRendererContribution)
export class ViewContribution implements SlotRendererContribution {
  registerRenderer(registry: SlotRendererRegistry) {
    registry.registerSlotRenderer(SlotLocation.right, RightTabRenderer);
  }

}
