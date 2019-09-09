import { SlotLocation, AppConfig } from '../react-providers';
import { Autowired, Injectable } from '@ali/common-di';
import { URI, BasicEvent, MaybeNull } from '@ali/ide-core-common';
import { TabBar, Widget, Title } from '@phosphor/widgets';
import { Signal } from '@phosphor/signaling';

export interface TabbarState {
  containerId: string;
  hidden: boolean;
}
export interface SideState {
  currentIndex: number;
  size: number;
  // 给底部panel，左右侧由currentIndex映射
  collapsed?: boolean;
  tabbars: TabbarState[];
}

export interface SideStateManager {
  [side: string]: MaybeNull<SideState>;
}

export interface View {
  id: string;
  name?: string;
  weight?: number;
  collapsed?: boolean;
  hidden?: boolean;
  component?: React.FunctionComponent<any>;
}

export interface ViewContainerOptions extends ExtViewContainerOptions {
  containerId: string;
}
export interface ExtViewContainerOptions {
  iconClass?: string;
  icon?: URI;
  weight?: number;
  containerId?: string;
  // 左右侧及底部面板必传
  title?: string;
  size?: number;
  initialProps?: object;
  activateKeyBinding?: string;
  hidden?: boolean;
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
  constructor(public width: number, public height: number, public slotLocation: SlotLocation) {
  }
}
export class ResizeEvent extends BasicEvent<ResizePayload> {}

export interface ITabbarWidget extends Widget {
  tabBar: TabBar<Widget>;
  currentChanged: Signal<this, TabBarWidget.ICurrentChangedArgs>;
  onCollapse: Signal<this, Title<Widget>>;
  showPanel(size?: number): void;
  getWidget(index: number): Widget;
  addWidget(widget: Widget, side: Side, index?: number): void;
  currentWidget: Widget | null;
}

export type Side = 'left' | 'right' | 'bottom';

export namespace TabBarWidget {
  /**
   * A type alias for tab placement in a tab bar.
   */
  export type TabPlacement = (
    /**
     * The tabs are placed as a row above the content.
     */
    'top' |

    /**
     * The tabs are placed as a column to the left of the content.
     */
    'left' |

    /**
     * The tabs are placed as a column to the right of the content.
     */
    'right' |

    /**
     * The tabs are placed as a row below the content.
     */
    'bottom'
  );

  /**
   * An options object for initializing a tab panel.
   */
  export interface IOptions {
    /**
     * Whether the tabs are movable by the user.
     *
     * The default is `false`.
     */
    tabsMovable?: boolean;

    /**
     * The placement of the tab bar relative to the content.
     *
     * The default is `'top'`.
     */
    tabPlacement?: TabPlacement;

    /**
     * The renderer for the panel's tab bar.
     *
     * The default is a shared renderer instance.
     */
    renderer?: TabBar.IRenderer<Widget>;
  }

  /**
   * The arguments object for the `currentChanged` signal.
   */
  export interface ICurrentChangedArgs {
    /**
     * The previously selected index.
     */
    previousIndex: number;

    /**
     * The previously selected widget.
     */
    previousWidget: Widget | null;

    /**
     * The currently selected index.
     */
    currentIndex: number;

    /**
     * The currently selected widget.
     */
    currentWidget: Widget | null;
  }
}
