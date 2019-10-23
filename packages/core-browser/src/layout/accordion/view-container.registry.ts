import { ActivityPanelToolbar } from '@ali/ide-activity-panel/lib/browser';
import { AccordionWidget } from './accordion.widget';

export class ViewContainerRegistry {
  registry: Map<string, { titleBar?: ActivityPanelToolbar, accordion: AccordionWidget }> = new Map();

  registerViewContainer(accordion: AccordionWidget, titleBar?: ActivityPanelToolbar) {

  }
}
