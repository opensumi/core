import { SlotLocation } from './slot';
import { SlotMap } from './config-provider';

export class SlotRegistry {
  constructor(
    protected slotMap: SlotMap,
  ) {}

  register(location: SlotLocation, component: React.FunctionComponent) {
    const slotMap = this.slotMap;
    if (!slotMap.has(location)) {
      slotMap.set(location, component);
    }
  }
}
