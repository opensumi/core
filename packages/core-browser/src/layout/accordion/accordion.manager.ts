import { Injectable, Injector, Autowired, INJECTOR_TOKEN } from '@ali/common-di';
import { AccordionWidget } from './accordion.widget';
import { View } from '..';

@Injectable()
export class AccordionManager {
  accordions: Map<string, AccordionWidget> = new Map();

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  getAccordion(containerId: string, views: View[], side: string) {
    const accordion = this.accordions.get(containerId) || this.injector.get(AccordionWidget, [containerId, views, side as any]);
    if (!this.accordions.get(containerId)) {
      this.accordions.set(containerId, accordion);
    }
    return accordion;
  }
}
