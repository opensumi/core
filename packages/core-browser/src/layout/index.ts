import { SlotLocation, AppConfig } from '../react-providers';
import { Autowired, Injectable } from '@ali/common-di';
import { View, ViewContainerOptions } from '@ali/ide-activity-panel/lib/browser/views-container-widget';

export interface ComponentInfo {
  componentId?: string;
  component: React.FunctionComponent;
  viewId?: string;
  viewName?: string;
  title?: string;
  iconClass?: string;
  size?: number;
  weight?: number;
  initialProps?: object;
  onActive?: () => void;
  onInActive?: () => void;
  onCollapse?: () => void;
}

export const ComponentRegistry = Symbol('ComponentRegistry');

export interface ComponentRegistry {
  register(key: string, views: View | View[], options?: ViewContainerOptions, location?: SlotLocation): void;

  getComponentRegistryInfo(key: string): ComponentRegistryInfo | undefined;
}

export interface ComponentRegistryInfo {
  views: View[];
  options?: ViewContainerOptions;
}
@Injectable()
export class ComponentRegistryImpl implements ComponentRegistry {
  componentsMap: Map<string, ComponentRegistryInfo> = new Map();

  @Autowired(AppConfig)
  private config: AppConfig;

  register(key: string, views: View | View[], options?: ViewContainerOptions, location?: SlotLocation) {
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
    if (location) {
      let targetLocation = this.config.layoutConfig[location];
      if (!targetLocation) {
        targetLocation = {
          modules: [],
        };
        this.config.layoutConfig[location] = targetLocation;
      }
      if (targetLocation.modules.indexOf(key) > -1) {
        console.warn(`${location}位置已存在${key}模块`);
        return;
      }
      targetLocation.modules.push(key);
    }
  }

  getComponentRegistryInfo(key) {
    const componentInfo = this.componentsMap.get(key);
    return componentInfo;
  }
}

export interface LayoutContribution {
  // 将组件绑定到一个字符串
  registerComponent(registry: ComponentRegistry): void;
}

export const LayoutContribution = Symbol('LayoutContribution');
