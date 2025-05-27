import { CommandRegistry, ComponentRegistryProvider, DisposableCollection } from '@opensumi/ide-core-browser';
import { ResizeHandle } from '@opensumi/ide-core-browser/lib/components';
import { AbstractContextMenuService, IContextMenu, IMenuRegistry } from '@opensumi/ide-core-browser/lib/menu/next';
import { TabbarConfig } from '@opensumi/ide-core-browser/lib/react-providers';
import { IMainLayoutService } from '@opensumi/ide-main-layout/lib/common';

export interface ITabbarResizeOptions {
  setSize: (targetSize?: number) => void;
  setRelativeSize: (prev: number, next: number) => void;
  getSize: () => number;
  getRelativeSize: () => number[];
  lockSize: (lock: boolean | undefined) => void;
  setMaxSize: (lock: boolean | undefined) => void;
  hidePanel: (show?: boolean) => void;
}

/**
 * 抽象基类，定义不同 location 的 tabbar 行为策略
 */
export abstract class BaseTabbarStrategy {
  constructor(protected location: string, protected tabbarConfig?: TabbarConfig) {}

  /**
   * 获取 isLatter 配置
   */
  protected getIsLatter(): boolean {
    if (this.tabbarConfig?.isLatter !== undefined) {
      return this.tabbarConfig.isLatter;
    }
    // 默认配置：扩展视图和底部面板为后置位置
    return this.location === 'extendView' || this.location === 'panel';
  }

  /**
   * 注册特定于该位置的命令
   */
  abstract registerLocationSpecificCommands(context: {
    commandRegistry: CommandRegistry;
    layoutService: IMainLayoutService;
  }): DisposableCollection;

  /**
   * 注册特定于该位置的菜单
   */
  abstract registerLocationSpecificMenus(context: {
    menuRegistry: IMenuRegistry;
    ctxMenuService: AbstractContextMenuService;
  }): IContextMenu | undefined;

  /**
   * 包装 resize handle 以适配该位置的行为
   */
  abstract wrapResizeHandle(resizeHandle: ResizeHandle): ITabbarResizeOptions;

  /**
   * 处理展开/收缩逻辑
   */
  abstract doExpand(expand: boolean, resizeHandle?: ITabbarResizeOptions): void;

  /**
   * 判断是否处于展开状态
   */
  abstract isExpanded(resizeHandle?: ITabbarResizeOptions): boolean;

  /**
   * 激活快捷键的处理逻辑
   */
  abstract handleActivateKeyBinding(
    containerId: string,
    currentContainerId: string,
    updateCurrentContainerId: (id: string) => void,
    forceShow?: boolean,
  ): void;

  abstract handleFullExpanded(
    currentId: string,
    isCurrentExpanded: boolean,
    resizeHandle: ITabbarResizeOptions,
    options: { barSize: number; panelSize: number; prevSize?: number },
  ): void;

  abstract tryRestoreAccordionSize(containerInfo: ComponentRegistryProvider, layoutService: IMainLayoutService): void;
}
