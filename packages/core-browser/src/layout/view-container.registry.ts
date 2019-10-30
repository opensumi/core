import { ActivityPanelToolbar } from './view-container-toolbar';
import { AccordionWidget } from './accordion/accordion.widget';
import { Injectable } from '@ali/common-di';

@Injectable()
export class ViewContainerRegistry {
  accordionRegistry: Map<string, AccordionWidget> = new Map();

  registerAccordion(containerId: string, accordion: AccordionWidget) {
    this.accordionRegistry.set(containerId, accordion);
  }

  getAccordion(containerId: string) {
    return this.accordionRegistry.get(containerId);
  }

  titleBarRegistry: Map<string, ActivityPanelToolbar> = new Map();

  registerTitleBar(containerId: string, titleBar: ActivityPanelToolbar) {
    this.titleBarRegistry.set(containerId, titleBar);
  }

  getTitleBar(containerId: string) {
    return this.titleBarRegistry.get(containerId);
  }
}
