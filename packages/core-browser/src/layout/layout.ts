import { Injectable } from '@opensumi/di';
import { BasicEvent } from '@opensumi/ide-core-common';

import { SlotLocation } from '../react-providers';

import { ComponentRegistry, ComponentRegistryInfo, View, ViewContainerOptions } from './layout.interface';

export class VisibleChangedPayload {
  constructor(public isVisible: boolean, public slotLocation: SlotLocation) {}
}

export class VisibleChangedEvent extends BasicEvent<VisibleChangedPayload> {}

export function measurePriority(weights: number[], weight?: number): number {
  if (!weights.length) {
    weights.splice(0, 0, weight || 0);
    return 0;
  }
  let i = weights.length - 1;
  if (!weight) {
    weights.splice(i + 1, 0, 0);
    return i + 1;
  }
  for (; i >= 0; i--) {
    if (weight < weights[i]) {
      break;
    }
  }
  weights.splice(i + 1, 0, weight);
  return i + 1;
}

@Injectable()
export class ComponentRegistryImpl implements ComponentRegistry {
  componentsMap: Map<string, ComponentRegistryInfo> = new Map();

  register(key: string, views: View | View[], options?: ViewContainerOptions) {
    if (Array.isArray(views)) {
      this.componentsMap.set(key, {
        views,
        options,
      });
    } else {
      this.componentsMap.set(key, {
        views: [views],
        options,
      });
    }
  }

  getComponentRegistryInfo(key: string): ComponentRegistryInfo | undefined {
    const componentRegistryInfo = this.componentsMap.get(key);
    return componentRegistryInfo;
  }
}

export interface ComponentContribution {
  // 将组件绑定到一个字符串
  registerComponent(registry: ComponentRegistry): void;
}

export const ComponentContribution = Symbol('ComponentContribution');
