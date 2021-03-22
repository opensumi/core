import { SlotLocation, AppConfig } from '../react-providers';
import { Autowired, Injectable } from '@ali/common-di';
import { BasicEvent, getDebugLogger, MaybeNull } from '@ali/ide-core-common';
import { IMenu, IContextMenu } from '../menu/next';

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

export interface TabbarState {
  containerId: string;
  hidden: boolean;
}
export interface SideState {
  currentIndex: number;
  size: number;

  // 给底部panel，左右侧由currentIndex映射、尺寸使用size
  collapsed?: boolean;
  relativeSize?: number[];

  expanded?: boolean;
  tabbars: TabbarState[];
}

export interface SideStateManager {
  [side: string]: MaybeNull<SideState>;
}

export interface View {
  id: string;
  name?: string;
  weight?: number;
  priority?: number;
  collapsed?: boolean;
  hidden?: boolean;
  component?: React.ComponentType<any>;
  // 使用该参数时, view 的 toolbar 默认不渲染
  noToolbar?: boolean;
  initialProps?: any;
  titleMenu?: IMenu | IContextMenu;
  titleMenuContext?: any;
  when?: string;
}

export interface ViewContainerOptions extends ExtViewContainerOptions {
  containerId: string;
}
export interface ExtViewContainerOptions {
  iconClass?: string;
  priority?: number;
  containerId?: string;
  // 左右侧及底部面板必传
  title?: string;
  expanded?: boolean;
  size?: number;
  activateKeyBinding?: string;
  hidden?: boolean;
  badge?: string;
  // 直接使用自定义的React组件，会失去一些对面板的控制能力
  component?: React.ComponentType<any>;
  // 使用自定义组件时可以传入，否则请作为View的一部分传入
  initialProps?: object;
  // 自定义标题组件
  titleComponent?: React.ComponentType<any>;
  // 自定义titleComponent时可选传入
  titleProps?: object;
  // 若views为空，则不显示该container
  hideIfEmpty?: boolean;
  // 隐藏tab图标，仅挂载视图，视图切换交给其他逻辑控制
  hideTab?: boolean;
  noResize?: boolean;
  fromExtension?: boolean;
}
export const ComponentRegistry = Symbol('ComponentRegistry');

export interface ComponentRegistry {
  register(key: string, views: View | View[], options?: ExtViewContainerOptions, location?: SlotLocation): void;

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
    // deprecated, use layout config instead
    if (location) {
      let targetLocation = this.config.layoutConfig[location];
      if (!targetLocation) {
        targetLocation = {
          modules: [],
        };
        this.config.layoutConfig[location] = targetLocation;
      }
      if (targetLocation.modules.indexOf(key) > -1) {
        getDebugLogger().warn(`${location}位置已存在${key}模块`);
        return;
      }
      targetLocation.modules.push(key);
    }
  }

  getComponentRegistryInfo(key): ComponentRegistryInfo | undefined {
    const componentRegistryInfo = this.componentsMap.get(key);
    return componentRegistryInfo;
  }
}

export interface ComponentContribution {
  // 将组件绑定到一个字符串
  registerComponent(registry: ComponentRegistry): void;
}

export const ComponentContribution = Symbol('ComponentContribution');

export class ResizePayload {
  constructor(public slotLocation: SlotLocation) {
  }
}
export class ResizeEvent extends BasicEvent<ResizePayload> {}

export class RenderedEvent extends BasicEvent<void> {}

export type Side = 'left' | 'right' | 'bottom';

export interface ViewState {
  width: number;
  height: number;
}

export * from './accordion/view-context-key.registry';
export * from './accordion/view-container-state';
export * from './accordion/tab-bar-toolbar';
