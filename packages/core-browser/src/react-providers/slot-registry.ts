import { SlotLocation } from './slot';
import { SlotMap } from './config-provider';
import { LayoutConfig } from '../bootstrap';

export class SlotRegistry {
  constructor(
    protected slotMap: SlotMap,
  ) {}

  register(location: SlotLocation, component: React.FunctionComponent) {
    console.error('duprecated');
    const slotMap = this.slotMap;
    if (!slotMap.has(location)) {
      slotMap.set(location, [component]);
    } else {
      slotMap[location].push(component);
    }
  }

  use(layoutConfig: LayoutConfig) {
    const slotMap = this.slotMap;
    for (const location of Object.keys(layoutConfig)) {
      slotMap.set(location, layoutConfig[location].components);
    }
  }
}
